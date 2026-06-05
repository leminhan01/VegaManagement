import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.product.create({
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
      },
      include: {
        category: true,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
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

    return this.prisma.product.update({
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
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
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
