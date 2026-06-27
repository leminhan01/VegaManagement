import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import {
  createPaginatedResult,
  getPaginationParams,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { CreateStorefrontOrderDto } from './dto/create-storefront-order.dto';
import { FilterStorefrontProductsDto } from './dto/filter-storefront-products.dto';

// Chỉ select field an toàn cho khách — KHÔNG trả minStock/sku/embeddedAt/isPublished.
const PRODUCT_PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDesc: true,
  description: true,
  price: true,
  salePrice: true,
  images: true,
  unit: true,
  tags: true,
  origin: true,
  stock: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

// Include cho đơn của khách — KHÔNG lộ batch/warehouse internals.
const STOREFRONT_ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        select: { id: true, name: true, slug: true, images: true, unit: true },
      },
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  // ── Sản phẩm (public) ───────────────────────────

  async findPublishedProducts(
    filter: FilterStorefrontProductsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      isPublished: true,
    };
    if (filter.search) {
      where.name = { contains: filter.search, mode: 'insensitive' };
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }

    const sortable = new Set(['createdAt', 'name', 'price']);
    const sort =
      params.sort && sortable.has(params.sort) ? params.sort : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_PUBLIC_SELECT,
        orderBy: { [sort]: params.order },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async findPublishedProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true, isPublished: true },
      select: PRODUCT_PUBLIC_SELECT,
    });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc đã ngừng bán');
    }
    return product;
  }

  async findActiveCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, image: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Đơn hàng của khách (cần đăng nhập) ──────────

  async findMyOrders(
    customerId: string,
    query: { page?: number; limit?: number },
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(query);
    const where: Prisma.OrderWhereInput = { customerId };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: STOREFRONT_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async findMyOrder(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: STOREFRONT_ORDER_INCLUDE,
    });

    // Mismatch → 404 (không 403) để không lộ đơn của người khác có tồn tại.
    if (!order || order.customerId !== customerId) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    return order;
  }

  /** Tạo đơn từ storefront — customerId lấy từ JWT, không tin DTO. */
  async createOrder(customerId: string, dto: CreateStorefrontOrderDto) {
    return this.ordersService.createWithCustomerId(customerId, {
      items: dto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingAddress: dto.shippingAddress,
      shippingPhone: dto.shippingPhone,
      paymentMethod: dto.paymentMethod,
      note: dto.note,
    });
  }
}
