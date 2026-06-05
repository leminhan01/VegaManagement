import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getPaginationParams,
  createPaginatedResult,
  PaginationParams,
} from '../common/utils/pagination.util';
import {
  SearchProductsDto,
  SuggestProductsDto,
  UpsertSessionDto,
  CreateMessageDto,
} from './dto/search-products.dto';

@Injectable()
export class BotApiService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Products ──────────────────────────────────────────────

  async searchProducts(query: SearchProductsDto) {
    const { page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { isActive: true };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { shortDesc: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = { slug: query.category };
    }

    if (query.tags) {
      const tags = query.tags.split(',').map((t) => t.trim());
      where.tags = { hasSome: tags };
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const params: PaginationParams = { page, limit, sort: 'createdAt', order: 'desc' };
    return createPaginatedResult(data, total, params);
  }

  async getProductDetail(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: { category: { select: { name: true, slug: true } } },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
  }

  async getStock(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      select: { stock: true, minStock: true, unit: true, name: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return {
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit,
      productName: product.name,
    };
  }

  async suggestProducts(query: SuggestProductsDto) {
    const { page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { isActive: true };

    if (query.prefs) {
      const prefs = query.prefs.split(',').map((p) => p.trim());
      where.OR = [
        { tags: { hasSome: prefs } },
        { name: { contains: query.prefs, mode: 'insensitive' } },
        { description: { contains: query.prefs, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const params: PaginationParams = { page, limit, sort: 'createdAt', order: 'desc' };
    return createPaginatedResult(data, total, params);
  }

  // ── Categories ────────────────────────────────────────────

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      productCount: cat._count.products,
    }));
  }

  // ── Orders ────────────────────────────────────────────────

  async getOrderByCode(code: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode: code },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with code "${code}" not found`);
    }

    return order;
  }

  // ── Customers ─────────────────────────────────────────────

  async getCustomerOrders(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with phone "${phone}" not found`);
    }

    const orders = await this.prisma.order.findMany({
      where: { customerId: customer.id },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      orders,
    };
  }

  // ── Chat Sessions (Bot) ───────────────────────────────────

  async upsertSession(dto: UpsertSessionDto) {
    return this.prisma.chatSession.upsert({
      where: {
        platform_platformUserId: {
          platform: dto.platform,
          platformUserId: dto.platformUserId,
        },
      },
      update: {
        customerId: dto.customerId,
        guestPhone: dto.guestPhone,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      create: {
        platform: dto.platform,
        platformUserId: dto.platformUserId,
        customerId: dto.customerId,
        guestPhone: dto.guestPhone,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async saveMessage(sessionId: string, dto: CreateMessageDto) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Chat session with id "${sessionId}" not found`);
    }

    return this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: dto.role as 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL',
        content: dto.content,
        metadata: dto.metadata as any ?? undefined,
      },
    });
  }
}
