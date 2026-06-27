import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  createPaginatedResult,
  getPaginationParams,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

type OrderLine = {
  productId: string;
  quantity: number;
};

const ORDER_INCLUDE = {
  customer: true,
  items: {
    include: {
      product: {
        include: {
          category: true,
        },
      },
      batch: true,
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filter: FilterOrdersDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.OrderWhereInput = {};

    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.paymentMethod) where.paymentMethod = filter.paymentMethod;

    if (filter.search) {
      where.OR = [
        { orderCode: { contains: filter.search, mode: 'insensitive' } },
        { shippingPhone: { contains: filter.search, mode: 'insensitive' } },
        { customer: { name: { contains: filter.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {
        ...(filter.dateFrom && { gte: this.startOfDay(filter.dateFrom) }),
        ...(filter.dateTo && { lte: this.endOfDay(filter.dateTo) }),
      };
    }

    const sortableFields = new Set([
      'createdAt',
      'updatedAt',
      'finalAmount',
      'totalAmount',
      'status',
    ]);
    const sort = params.sort && sortableFields.has(params.sort) ? params.sort : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { [sort]: params.order },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  async findByCode(orderCode: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
      include: ORDER_INCLUDE,
    });

    if (!order) throw new NotFoundException(`Order ${orderCode} not found`);
    return order;
  }

  async create(dto: CreateOrderDto) {
    // Admin path: customerId do client cung cấp (đã có JWT admin bảo vệ).
    return this.createWithCustomerId(dto.customerId, {
      items: dto.items,
      shippingAddress: dto.shippingAddress,
      shippingPhone: dto.shippingPhone,
      paymentMethod: dto.paymentMethod,
      note: dto.note,
      discount: dto.discount,
    });
  }

  /**
   * Nguồn sự thật duy nhất cho logic tạo đơn (validate customer, normalize items,
   * pricing, giảm stock + StockMovement, gen orderCode, tính tiền). Dùng chung cho:
   * - Admin: create() ở trên.
   * - Storefront: StorefrontService.createOrder() — customerId lấy từ JWT khách.
   */
  async createWithCustomerId(
    customerId: string,
    payload: {
      items: OrderLine[];
      shippingAddress: string;
      shippingPhone: string;
      paymentMethod: PaymentMethod;
      note?: string | null;
      discount?: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCustomerExists(tx, customerId);
      const normalizedItems = this.normalizeItems(payload.items);
      const pricing = await this.getPricing(tx, normalizedItems);
      const orderCode = await this.generateOrderCode(tx);
      await this.decreaseStock(tx, normalizedItems, 'Order sale', orderCode);

      const totalAmount = this.calculateTotal(normalizedItems, pricing.priceMap);
      const discount = payload.discount ?? 0;

      return tx.order.create({
        data: {
          orderCode,
          customerId,
          totalAmount,
          discount,
          finalAmount: Math.max(0, totalAmount - discount),
          shippingAddress: payload.shippingAddress,
          shippingPhone: payload.shippingPhone,
          note: payload.note,
          paymentMethod: payload.paymentMethod,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: pricing.priceMap.get(item.productId)!,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
      if (['SHIPPED', 'DELIVERED', 'REFUNDING', 'REFUNDED'].includes(order.status)) {
        throw new BadRequestException('Only pending, confirmed, processing, or cancelled orders can be edited');
      }

      if (dto.customerId) await this.assertCustomerExists(tx, dto.customerId);

      let totalAmount = order.totalAmount;
      let discount = dto.discount ?? order.discount;

      if (dto.items) {
        const oldItems = order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));
        if (this.hasReservedStock(order.status)) {
          await this.increaseStock(tx, oldItems, 'Order edit rollback', order.orderCode);
        }

        const newItems = this.normalizeItems(dto.items);
        const pricing = await this.getPricing(tx, newItems);
        if (this.hasReservedStock(order.status)) {
          await this.decreaseStock(tx, newItems, 'Order edit', order.orderCode);
        }

        totalAmount = this.calculateTotal(newItems, pricing.priceMap);
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: newItems.map((item) => ({
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: pricing.priceMap.get(item.productId)!,
          })),
        });
      }

      if (discount > totalAmount) discount = totalAmount;

      return tx.order.update({
        where: { id },
        data: {
          ...(dto.customerId !== undefined && { customerId: dto.customerId }),
          ...(dto.shippingAddress !== undefined && {
            shippingAddress: dto.shippingAddress,
          }),
          ...(dto.shippingPhone !== undefined && { shippingPhone: dto.shippingPhone }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.paymentMethod !== undefined && {
            paymentMethod: dto.paymentMethod,
          }),
          totalAmount,
          discount,
          finalAmount: Math.max(0, totalAmount - discount),
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order with ID ${id} not found`);

      this.validateStatusTransition(order.status, dto.status);
      if (dto.status === OrderStatus.REFUNDED) {
        await this.increaseStock(
          tx,
          order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          'Order refund',
          order.orderCode,
        );
      }

      return tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === OrderStatus.SHIPPED && { shippedAt: new Date() }),
          ...(dto.status === OrderStatus.DELIVERED && {
            deliveredAt: new Date(),
            paidAt: order.paidAt ?? new Date(),
          }),
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  async cancel(id: string) {
    return this.changeToTerminalStatus(id, OrderStatus.CANCELLED, 'Order cancel');
  }

  async refund(id: string) {
    return this.changeToTerminalStatus(id, OrderStatus.REFUNDED, 'Order refund');
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
      if (!['PENDING', 'CANCELLED'].includes(order.status)) {
        throw new BadRequestException('Only pending or cancelled orders can be deleted');
      }

      if (this.hasReservedStock(order.status)) {
        await this.increaseStock(
          tx,
          order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          'Order delete',
          order.orderCode,
        );
      }

      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }

  async getInvoice(id: string) {
    const order = await this.findOne(id);
    return {
      invoiceNo: `INV-${order.orderCode}`,
      issuedAt: new Date().toISOString(),
      seller: {
        name: process.env.STORE_NAME ?? 'VeggieShop',
        phone: process.env.STORE_PHONE ?? '',
        address: process.env.STORE_ADDRESS ?? '',
      },
      order,
      totals: {
        totalAmount: order.totalAmount,
        discount: order.discount,
        finalAmount: order.finalAmount,
      },
    };
  }

  async getReport(filter: FilterOrdersDto) {
    const where: Prisma.OrderWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.paymentMethod) where.paymentMethod = filter.paymentMethod;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {
        ...(filter.dateFrom && { gte: this.startOfDay(filter.dateFrom) }),
        ...(filter.dateTo && { lte: this.endOfDay(filter.dateTo) }),
      };
    }

    const [orders, byStatus, byPayment, topProducts] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { finalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { _all: true },
        _sum: { finalAmount: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: where },
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
    ]);

    const productIds = topProducts.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, unit: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const daily = new Map<string, { orders: number; revenue: number }>();
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const current = daily.get(key) ?? { orders: 0, revenue: 0 };
      current.orders += 1;
      if (order.status === OrderStatus.DELIVERED) current.revenue += order.finalAmount;
      daily.set(key, current);
    }

    return {
      totalOrders: orders.length,
      revenue: orders
        .filter((order) => order.status === OrderStatus.DELIVERED)
        .reduce((sum, order) => sum + order.finalAmount, 0),
      pendingValue: orders
        .filter((order) =>
          ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status),
        )
        .reduce((sum, order) => sum + order.finalAmount, 0),
      averageOrderValue:
        orders.length === 0
          ? 0
          : orders.reduce((sum, order) => sum + order.finalAmount, 0) / orders.length,
      byStatus,
      byPayment,
      topProducts: topProducts.map((item) => ({
        product: productMap.get(item.productId) ?? { id: item.productId },
        quantity: item._sum.quantity ?? 0,
        orderLines: item._count._all,
      })),
      daily: Array.from(daily.entries()).map(([day, value]) => ({ day, ...value })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async changeToTerminalStatus(
    id: string,
    status: Extract<OrderStatus, 'CANCELLED' | 'REFUNDED'>,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order with ID ${id} not found`);

      if (status === OrderStatus.CANCELLED) {
        if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
          throw new BadRequestException('Only pending, confirmed, or processing orders can be cancelled');
        }
      } else if (!['DELIVERED', 'REFUNDING'].includes(order.status)) {
        throw new BadRequestException('Only delivered or refunding orders can be refunded');
      }

      await this.increaseStock(
        tx,
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        reason,
        order.orderCode,
      );

      return tx.order.update({
        where: { id },
        data: { status },
        include: ORDER_INCLUDE,
      });
    });
  }

  private async assertCustomerExists(tx: Prisma.TransactionClient, customerId: string) {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer with ID ${customerId} not found`);
  }

  private normalizeItems(items: OrderLine[]): OrderLine[] {
    if (!items.length) throw new BadRequestException('Order must have at least one item');

    const map = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) throw new BadRequestException('Product is required');
      if (item.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }

    return Array.from(map.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }

  private async getPricing(tx: Prisma.TransactionClient, items: OrderLine[]) {
    const productIds = items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        price: true,
        salePrice: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more active products were not found');
    }

    return {
      priceMap: new Map(
        products.map((product) => [
          product.id,
          product.salePrice ?? product.price,
        ]),
      ),
    };
  }

  private calculateTotal(items: OrderLine[], priceMap: Map<string, number>) {
    return items.reduce(
      (sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity,
      0,
    );
  }

  private async decreaseStock(
    tx: Prisma.TransactionClient,
    items: OrderLine[],
    reason: string,
    reference?: string,
  ) {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true },
      });
      if (!product) throw new NotFoundException(`Product with ID ${item.productId} not found`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Product ${item.productId} stock is not enough`);
      }

      const afterStock = product.stock - item.quantity;
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          beforeStock: product.stock,
          afterStock,
          reason,
          reference,
        },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: afterStock },
      });
    }
  }

  private async increaseStock(
    tx: Prisma.TransactionClient,
    items: OrderLine[],
    reason: string,
    reference?: string,
  ) {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true },
      });
      if (!product) throw new NotFoundException(`Product with ID ${item.productId} not found`);

      const afterStock = product.stock + item.quantity;
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'IN',
          quantity: item.quantity,
          beforeStock: product.stock,
          afterStock,
          reason,
          reference,
        },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: afterStock },
      });
    }
  }

  private hasReservedStock(status: OrderStatus) {
    return status !== OrderStatus.CANCELLED && status !== OrderStatus.REFUNDED;
  }

  private async generateOrderCode(tx: Prisma.TransactionClient): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const prefix = `VF-${dateStr}`;
    const lastOrder = await tx.order.findFirst({
      where: { orderCode: { startsWith: prefix } },
      orderBy: { orderCode: 'desc' },
      select: { orderCode: true },
    });

    const sequence = lastOrder
      ? Number(lastOrder.orderCode.split('-').at(-1) ?? '0') + 1
      : 1;

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
    if (current === next) return;
    if (current === OrderStatus.CANCELLED || current === OrderStatus.REFUNDED) {
      throw new BadRequestException('Terminal orders cannot change status');
    }
    if (next === OrderStatus.CANCELLED) {
      throw new BadRequestException('Use the cancel endpoint to cancel orders');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDING],
      [OrderStatus.REFUNDING]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Cannot transition order from ${current} to ${next}`,
      );
    }
  }

  private startOfDay(value: string) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
