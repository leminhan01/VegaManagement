import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingSyncService } from './embeddings-sync.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import {
  getPaginationParams,
  createPaginatedResult,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingSync: EmbeddingSyncService,
  ) {}

  /**
   * Đẩy product sang chatbot để (re-)tạo embedding. Best-effort:
   * - Thành công → set `embeddedAt`.
   * - Thất bại (chatbot/OpenAI lỗi) → log warning, KHÔNG throw, để nghiệp vụ
   *   tạo/sửa vẫn hoàn tất. Admin có thể bấm nút Embed để retry.
   */
  private async refreshEmbedding(product: {
    id: string;
    name: string;
    description?: string | null;
  }): Promise<void> {
    const ok = await this.embeddingSync.syncProductEmbedding(product);
    if (ok) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: { embeddedAt: new Date() },
      });
    } else {
      this.logger.warn(
        `Embedding sản phẩm ${product.id} chưa được cập nhật — dùng nút Embed để thử lại.`,
      );
    }
  }

  async findAll(
    filter: FilterProductsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.ProductWhereInput = {};

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }

    if (filter.search) {
      where.name = { contains: filter.search, mode: 'insensitive' };
    }

    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.price = {
        ...(filter.minPrice !== undefined && { gte: filter.minPrice }),
        ...(filter.maxPrice !== undefined && { lte: filter.maxPrice }),
      };
    }

    if (filter.tags && filter.tags.length > 0) {
      where.tags = { hasSome: filter.tags };
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: { [params.sort ?? 'createdAt']: params.order },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID "${id}" không tồn tại`);
    }

    return product;
  }

  async create(dto: CreateProductDto) {
    return this.createInternal(dto, true);
  }

  /**
   * Giống create() nhưng embedding chạy fire-and-forget (không await). Dành cho
   * import hàng loạt: mỗi lần sync embedding có timeout 30s, nếu await từng dòng
   * thì file vài trăm dòng sẽ bị treo / timeout gateway.
   */
  async createNoBlock(dto: CreateProductDto) {
    return this.createInternal(dto, false);
  }

  private async createInternal(
    dto: CreateProductDto,
    blockingEmbedding: boolean,
  ) {
    // Check unique slug
    if (dto.slug) {
      const existingSlug = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictException(
          `Sản phẩm với slug "${dto.slug}" đã tồn tại`,
        );
      }
    }

    // Check unique sku
    const existingSku = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existingSku) {
      throw new ConflictException(
        `Sản phẩm với SKU "${dto.sku}" đã tồn tại`,
      );
    }

    // Verify category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Danh mục với ID "${dto.categoryId}" không tồn tại`,
      );
    }

    const created = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug!,
        description: dto.description,
        shortDesc: dto.shortDesc,
        price: dto.price,
        salePrice: dto.salePrice,
        categoryId: dto.categoryId,
        tags: dto.tags ?? [],
        ingredients: dto.ingredients,
        nutritionInfo: dto.nutritionInfo as any ?? undefined,
        allergens: dto.allergens ?? [],
        origin: dto.origin,
        images: dto.images ?? [],
        stock: dto.stock,
        minStock: dto.minStock ?? 10,
        sku: dto.sku,
        unit: dto.unit ?? 'cái',
        isActive: dto.isActive ?? true,
        isPublished: false, // mặc định draft — admin embed + publish thủ công
      },
      include: {
        category: true,
      },
    });

    // Tự tạo embedding ngay khi thêm sản phẩm (best-effort).
    if (blockingEmbedding) {
      await this.refreshEmbedding(created);
    } else {
      // Fire-and-forget: không chặn luồng import. Bắt lỗi để tránh unhandled rejection.
      void this.refreshEmbedding(created).catch((err) =>
        this.logger.warn(
          `Embedding nền cho sản phẩm ${created.id} thất bại: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }
    return this.prisma.product.findUniqueOrThrow({
      where: { id: created.id },
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    return this.updateInternal(id, dto, true);
  }

  /**
   * Giống update() nhưng embedding chạy fire-and-forget — dành cho import hàng
   * loạt (xem createNoBlock).
   */
  async updateNoBlock(id: string, dto: UpdateProductDto) {
    return this.updateInternal(id, dto, false);
  }

  private async updateInternal(
    id: string,
    dto: UpdateProductDto,
    blockingEmbedding: boolean,
  ) {
    await this.findOne(id);

    // Check unique constraints for slug if being updated
    if (dto.slug) {
      const existingSlug = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (existingSlug) {
        throw new ConflictException(
          `Sản phẩm với slug "${dto.slug}" đã tồn tại`,
        );
      }
    }

    // Check unique constraints for sku if being updated
    if (dto.sku) {
      const existingSku = await this.prisma.product.findFirst({
        where: { sku: dto.sku, NOT: { id } },
      });
      if (existingSku) {
        throw new ConflictException(
          `Sản phẩm với SKU "${dto.sku}" đã tồn tại`,
        );
      }
    }

    // Verify category exists if being updated
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Danh mục với ID "${dto.categoryId}" không tồn tại`,
        );
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.shortDesc !== undefined && { shortDesc: dto.shortDesc }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.ingredients !== undefined && { ingredients: dto.ingredients }),
        ...(dto.nutritionInfo !== undefined && {
          nutritionInfo: dto.nutritionInfo as any,
        }),
        ...(dto.allergens !== undefined && { allergens: dto.allergens }),
        ...(dto.origin !== undefined && { origin: dto.origin }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        category: true,
      },
    });

    // Chỉ re-embed khi đổi nội dung ảnh hưởng embedding (name/description),
    // tránh tốn OpenAI khi chỉ đổi stock/price.
    if (dto.name !== undefined || dto.description !== undefined) {
      if (blockingEmbedding) {
        await this.refreshEmbedding(updated);
        return this.prisma.product.findUniqueOrThrow({
          where: { id },
          include: { category: true },
        });
      }
      void this.refreshEmbedding(updated).catch((err) =>
        this.logger.warn(
          `Embedding nền cho sản phẩm ${id} thất bại: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    // Xóa embedding trong pgvector (best-effort) + ép unpublished để tránh
    // trạng thái "zombie" (đã ẩn nhưng vẫn published).
    await this.embeddingSync.deleteProductEmbedding(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false, isPublished: false },
    });
  }

  /**
   * Tạo/cập nhật embedding thủ công (nút Embed). Trả về trạng thái + embeddedAt.
   */
  async embed(id: string) {
    const product = await this.findOne(id);
    const ok = await this.embeddingSync.syncProductEmbedding(product);
    let embeddedAt: Date | null = product.embeddedAt;
    if (ok) {
      const refreshed = await this.prisma.product.update({
        where: { id },
        data: { embeddedAt: new Date() },
        select: { embeddedAt: true },
      });
      embeddedAt = refreshed.embeddedAt;
    }
    return { success: ok, embeddedAt };
  }

  /**
   * Publish sản phẩm lên chatbot. Yêu cầu ĐÃ có embedding (embeddedAt != null).
   */
  async publish(id: string) {
    const product = await this.findOne(id);
    if (!product.embeddedAt) {
      throw new BadRequestException(
        'Sản phẩm chưa có embedding. Vui lòng bấm Embed trước khi đăng.',
      );
    }
    return this.prisma.product.update({
      where: { id },
      data: { isPublished: true },
      include: { category: true },
    });
  }

  /** Gỡ sản phẩm khỏi chatbot (giữ nguyên embedding để publish lại nhanh). */
  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isPublished: false },
      include: { category: true },
    });
  }

  async updateStock(id: string, stock: number) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { stock },
      select: {
        id: true,
        name: true,
        stock: true,
        minStock: true,
      },
    });
  }
}
