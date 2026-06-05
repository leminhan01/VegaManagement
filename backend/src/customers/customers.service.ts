import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  createPaginatedResult,
  getPaginationParams,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type ShippingAddress = {
  label?: string;
  receiverName?: string;
  phone?: string;
  address: string;
  isDefault?: boolean;
};

const CUSTOMER_DETAIL_INCLUDE = {
  orders: {
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: true,
              unit: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
  chatSessions: {
    select: {
      id: true,
      platform: true,
      platformUserId: true,
      isActive: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  },
  _count: {
    select: { orders: true, chatSessions: true },
  },
} satisfies Prisma.CustomerInclude;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filter: FilterCustomersDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.CustomerWhereInput = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.group) where.group = filter.group;
    if (filter.tag) where.tags = { has: filter.tag };

    const sortFields = new Set(['createdAt', 'updatedAt', 'name', 'group']);
    const sort = params.sort && sortFields.has(params.sort) ? params.sort : 'createdAt';

    const customers = await this.prisma.customer.findMany({
      where,
      include: {
        orders: {
          select: {
            id: true,
            status: true,
            finalAmount: true,
            createdAt: true,
            shippingAddress: true,
            shippingPhone: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { orders: true, chatSessions: true },
        },
      },
      orderBy: { [sort]: params.order },
    });

    const enriched = customers
      .map((customer) => this.enrichCustomer(customer))
      .filter((customer) => {
        if (filter.minSpent !== undefined && customer.totalSpent < filter.minSpent) {
          return false;
        }
        if (filter.maxSpent !== undefined && customer.totalSpent > filter.maxSpent) {
          return false;
        }
        return true;
      });

    const data = enriched.slice(
      (params.page - 1) * params.limit,
      params.page * params.limit,
    );

    return createPaginatedResult(data, enriched.length, params);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: CUSTOMER_DETAIL_INCLUDE,
    });

    if (!customer) throw new NotFoundException(`Customer with ID ${id} not found`);

    return {
      ...customer,
      ...this.calculateStats(customer.orders),
      shippingAddresses: this.mergeShippingAddresses(customer),
    };
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      include: CUSTOMER_DETAIL_INCLUDE,
    });

    if (!customer) throw new NotFoundException(`Customer phone ${phone} not found`);

    return {
      ...customer,
      ...this.calculateStats(customer.orders),
      shippingAddresses: this.mergeShippingAddresses(customer),
    };
  }

  async getOrders(id: string, filter: FilterCustomersDto) {
    await this.assertExists(id);
    const params = getPaginationParams(filter);

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: id },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, images: true, unit: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.order.count({ where: { customerId: id } }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async getStats(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
      },
    });
    if (!customer) throw new NotFoundException(`Customer with ID ${id} not found`);

    const stats = this.calculateStats(customer.orders);
    const productMap = new Map<
      string,
      { product: Record<string, unknown>; quantity: number; amount: number }
    >();

    for (const order of customer.orders) {
      if (order.status !== OrderStatus.DELIVERED) continue;
      for (const item of order.items) {
        const current = productMap.get(item.productId) ?? {
          product: item.product,
          quantity: 0,
          amount: 0,
        };
        current.quantity += item.quantity;
        current.amount += item.quantity * item.unitPrice;
        productMap.set(item.productId, current);
      }
    }

    return {
      ...stats,
      group: customer.group,
      suggestedGroup: this.suggestGroup(stats.totalSpent, stats.totalOrders),
      topProducts: Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8),
    };
  }

  async create(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) throw new ConflictException('Customer phone already exists');

    return this.prisma.customer.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        shippingAddresses: dto.shippingAddresses as Prisma.InputJsonValue,
        tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
        group: dto.group?.trim() || 'REGULAR',
        note: dto.note?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.assertExists(id);

    if (dto.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: { phone: dto.phone, NOT: { id } },
      });
      if (existing) throw new ConflictException('Customer phone already exists');
    }

    return this.prisma.customer.update({
      where: { id },
      data: this.toCustomerData(dto),
      include: CUSTOMER_DETAIL_INCLUDE,
    });
  }

  async remove(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!customer) throw new NotFoundException(`Customer with ID ${id} not found`);
    if (customer._count.orders > 0) {
      throw new BadRequestException('Customers with orders cannot be deleted');
    }

    return this.prisma.customer.delete({ where: { id } });
  }

  async getGroups() {
    const customers = await this.prisma.customer.findMany({
      select: { group: true, tags: true },
    });

    const groups = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const customer of customers) {
      groups.set(customer.group, (groups.get(customer.group) ?? 0) + 1);
      for (const tag of customer.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }

    return {
      groups: Array.from(groups.entries()).map(([name, count]) => ({ name, count })),
      tags: Array.from(tags.entries()).map(([name, count]) => ({ name, count })),
    };
  }

  private async assertExists(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException(`Customer with ID ${id} not found`);
  }

  private toCustomerData(dto: CreateCustomerDto | UpdateCustomerDto) {
    return {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
      ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
      ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
      ...(dto.shippingAddresses !== undefined && {
        shippingAddresses: dto.shippingAddresses as Prisma.InputJsonValue,
      }),
      ...(dto.tags !== undefined && {
        tags: dto.tags.map((tag) => tag.trim()).filter(Boolean),
      }),
      ...(dto.group !== undefined && { group: dto.group.trim() || 'REGULAR' }),
      ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
    };
  }

  private enrichCustomer<
    T extends {
      orders: Array<{
        status: OrderStatus;
        finalAmount: number;
        createdAt: Date;
        shippingAddress: string;
        shippingPhone: string;
      }>;
      address: string | null;
      phone: string;
      name: string;
      shippingAddresses: Prisma.JsonValue | null;
    },
  >(customer: T) {
    return {
      ...customer,
      ...this.calculateStats(customer.orders),
      shippingAddresses: this.mergeShippingAddresses(customer),
    };
  }

  private calculateStats(
    orders: Array<{
      status: OrderStatus;
      finalAmount: number;
      createdAt: Date;
    }>,
  ) {
    const completed = orders.filter((order) => order.status === OrderStatus.DELIVERED);
    const active = orders.filter((order) =>
      ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status),
    );
    const totalSpent = completed.reduce((sum, order) => sum + order.finalAmount, 0);
    const lastOrder = orders[0];

    return {
      totalOrders: orders.length,
      completedOrders: completed.length,
      activeOrders: active.length,
      totalSpent,
      averageOrderValue:
        completed.length === 0 ? 0 : totalSpent / completed.length,
      lastOrderAt: lastOrder?.createdAt ?? null,
      suggestedGroup: this.suggestGroup(totalSpent, orders.length),
    };
  }

  private mergeShippingAddresses(customer: {
    address: string | null;
    phone: string;
    name: string;
    shippingAddresses: Prisma.JsonValue | null;
    orders?: Array<{ shippingAddress: string; shippingPhone: string }>;
  }): ShippingAddress[] {
    const addresses = new Map<string, ShippingAddress>();

    const saved = Array.isArray(customer.shippingAddresses)
      ? (customer.shippingAddresses as ShippingAddress[])
      : [];
    for (const item of saved) {
      if (item?.address) addresses.set(item.address, item);
    }

    if (customer.address) {
      addresses.set(customer.address, {
        label: 'Default',
        receiverName: customer.name,
        phone: customer.phone,
        address: customer.address,
        isDefault: true,
      });
    }

    for (const order of customer.orders ?? []) {
      if (!addresses.has(order.shippingAddress)) {
        addresses.set(order.shippingAddress, {
          label: 'Order address',
          receiverName: customer.name,
          phone: order.shippingPhone,
          address: order.shippingAddress,
        });
      }
    }

    return Array.from(addresses.values());
  }

  private suggestGroup(totalSpent: number, totalOrders: number) {
    if (totalSpent >= 5_000_000 || totalOrders >= 20) return 'VIP';
    if (totalSpent >= 2_000_000 || totalOrders >= 8) return 'LOYAL';
    if (totalOrders === 0) return 'LEAD';
    return 'REGULAR';
  }
}
