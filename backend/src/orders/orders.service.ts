import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { getPaginationParams, createPaginatedResult } from '../common/utils/pagination.util';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterOrdersDto) {
    const params = getPaginationParams(filter);
    const where: Prisma.OrderWhereInput = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.customerId) {
      where.customerId = filter.customerId;
    }
    if (filter.paymentMethod) {
      where.paymentMethod = filter.paymentMethod;
    }
    if (filter.search) {
      where.orderCode = { contains: filter.search, mode: 'insensitive' };
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        where.createdAt.gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        where.createdAt.lte = new Date(filter.dateTo);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { name: true, phone: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, images: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID: ${id}`);
    }

    return order;
  }

  async findByCode(orderCode: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã: ${orderCode}`);
    }

    return order;
  }

  async create(dto: CreateOrderDto) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${dto.customerId}`);
    }

    // Validate all products exist and gather prices
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = productIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với ID: ${missingIds.join(', ')}`,
      );
    }

    // Build price map (use salePrice if available)
    const priceMap = new Map<string, number>();
    for (const product of products) {
      priceMap.set(product.id, product.salePrice ?? product.price);
    }

    // Calculate total
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + priceMap.get(item.productId)! * item.quantity,
      0,
    );

    // Generate order code: VF-YYYYMMDD-NNN
    const orderCode = await this.generateOrderCode();

    const order = await this.prisma.order.create({
      data: {
        orderCode,
        customerId: dto.customerId,
        totalAmount,
        discount: 0,
        finalAmount: totalAmount,
        shippingAddress: dto.shippingAddress,
        shippingPhone: dto.shippingPhone,
        note: dto.note,
        paymentMethod: dto.paymentMethod,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: priceMap.get(item.productId)!,
          })),
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID: ${id}`);
    }

    const newStatus = dto.status;
    const currentStatus = order.status;

    // Validate transition
    this.validateStatusTransition(currentStatus, newStatus);

    // Prepare update data with timestamps
    const updateData: Prisma.OrderUpdateInput = { status: newStatus };

    if (newStatus === OrderStatus.SHIPPED) {
      updateData.shippedAt = new Date();
    }
    if (newStatus === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return updated;
  }

  async cancel(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID: ${id}`);
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Chỉ có thể hủy đơn hàng ở trạng thái PENDING hoặc CONFIRMED. Trạng thái hiện tại: ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Generate order code format: VF-YYYYMMDD-NNN
   * NNN is a sequential number for the day, starting from 001
   */
  private async generateOrderCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    const prefix = `VF-${dateStr}`;

    // Find the last order code for today
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        orderCode: { startsWith: prefix },
      },
      orderBy: { orderCode: 'desc' },
      select: { orderCode: true },
    });

    let sequence = 1;
    if (lastOrder) {
      const parts = lastOrder.orderCode.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
  }

  /**
   * Validate that the status transition is allowed
   */
  private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
    // Cancelled orders cannot be transitioned
    if (current === OrderStatus.CANCELLED) {
      throw new BadRequestException('Không thể thay đổi trạng thái đơn hàng đã hủy.');
    }

    // Cannot cancel via updateStatus — use the cancel endpoint
    if (next === OrderStatus.CANCELLED) {
      throw new BadRequestException('Vui lòng dùng API hủy đơn hàng để hủy.');
    }

    // Refunded/refunding transitions are only from DELIVERED
    if (
      (next === OrderStatus.REFUNDING || next === OrderStatus.REFUNDED) &&
      current !== OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Chỉ có thể hoàn tiền đơn hàng đã giao thành công.',
      );
    }

    // Define valid forward transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED],
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
        `Không thể chuyển từ ${current} sang ${next}. Các trạng thái hợp lệ tiếp theo: ${allowed.join(', ') || 'Không có'}`,
      );
    }
  }
}
