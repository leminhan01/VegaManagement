import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  getPaginationParams,
  createPaginatedResult,
  PaginationParams,
} from '../common/utils/pagination.util';
import {
  SearchProductsDto,
  SuggestProductsDto,
  SemanticSearchDto,
  UpsertSessionDto,
  CreateMessageDto,
} from './dto/search-products.dto';

@Injectable()
export class BotApiService {
  private readonly logger = new Logger(BotApiService.name);
  private readonly chatbotUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Chatbot service URL for embedding calls
    this.chatbotUrl = this.configService.get<string>('CHATBOT_SERVICE_URL', 'http://localhost:8000');
  }

  // ── Products ──────────────────────────────────────────────

  async searchProducts(query: SearchProductsDto) {
    const { page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { isActive: true, isPublished: true };

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
      where: { id, isActive: true, isPublished: true },
      include: { category: { select: { name: true, slug: true } } },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID "${id}"`);
    }

    return product;
  }

  async getStock(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true, isPublished: true },
      select: { stock: true, minStock: true, unit: true, name: true },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID "${id}"`);
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

    const where: Record<string, unknown> = { isActive: true, isPublished: true };

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

  // ── Semantic Search (gọi sang Chatbot/FastAPI embedding service) ──

  async semanticSearch(query: SemanticSearchDto) {
    // Gọi sang FastAPI embedding service để tìm kiếm semantic
    try {
      const response = await fetch(
        `${this.chatbotUrl}/embeddings/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.q,
            top_k: query.top_k ?? 5,
            min_similarity: query.min_similarity ?? 0.3,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      this.logger.error(`Lỗi semantic search: ${error.message}`);
      // Fallback: trả về mảng rỗng thay vì crash
      return { data: [], total: 0, error: 'Semantic search hiện không khả dụng' };
    }
  }

  // ── Store Config ──────────────────────────────────────────

  async getFullStoreInfo() {
    const [configs, branches] = await Promise.all([
      this.prisma.storeConfig.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.storeBranch.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    // Build key-value map từ configs
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    // Parse open_hours JSON nếu có
    let mainHours = null;
    if (configMap.open_hours) {
      try {
        mainHours = JSON.parse(configMap.open_hours);
      } catch {
        mainHours = configMap.open_hours;
      }
    }

    return {
      store: {
        name: configMap.store_name || '',
        description: configMap.store_description || '',
        address: configMap.address || '',
        phone: configMap.phone || '',
        hotline: configMap.hotline || '',
        email: configMap.email || '',
        logo: configMap.logo || '',
        openHours: mainHours,
      },
      social: {
        facebook: configMap.fanpage || '',
        zalo: configMap.zalo_oa || '',
        tiktok: configMap.tiktok || '',
        website: configMap.website || '',
      },
      policies: {
        returnPolicy: configMap.return_policy || '',
        shippingPolicy: configMap.shipping_policy || '',
        warrantyPolicy: configMap.warranty_policy || '',
      },
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        email: b.email,
        openHours: b.openHours,
        coordinates:
          b.latitude && b.longitude
            ? { lat: b.latitude, lng: b.longitude }
            : null,
      })),
    };
  }

  async getStoreConfig() {
    const configs = await this.prisma.storeConfig.findMany({
      orderBy: { key: 'asc' },
    });
    // Trả về dạng key-value object cho bot dễ dùng
    const result: Record<string, string> = {};
    for (const config of configs) {
      result[config.key] = config.value;
    }
    return result;
  }

  async getStoreConfigByKey(key: string) {
    const config = await this.prisma.storeConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException(`Không tìm thấy config với key "${key}"`);
    }

    return config;
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
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã "${code}"`);
    }

    return order;
  }

  // ── Customers ─────────────────────────────────────────────

  async getCustomerOrders(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });

    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với số điện thoại "${phone}"`);
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

  async getSession(sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Không tìm thấy phiên chat với ID "${sessionId}"`);
    }

    return session;
  }

  async saveMessage(sessionId: string, dto: CreateMessageDto) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Không tìm thấy phiên chat với ID "${sessionId}"`);
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
