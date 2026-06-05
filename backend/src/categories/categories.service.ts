import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FilterCategoriesDto } from './dto/filter-categories.dto';
import {
  getPaginationParams,
  createPaginatedResult,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filter: FilterCategoriesDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.CategoryWhereInput = {};

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.search) {
      where.name = { contains: filter.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { [params.sort ?? 'createdAt']: params.order },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Danh mục với ID "${id}" không tồn tại`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    // Check unique name
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name: dto.name }, { slug: dto.slug }],
      },
    });

    if (existing) {
      if (existing.name === dto.name) {
        throw new ConflictException(
          `Danh mục với tên "${dto.name}" đã tồn tại`,
        );
      }
      throw new ConflictException(
        `Danh mục với slug "${dto.slug}" đã tồn tại`,
      );
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug!,
        description: dto.description,
        image: dto.image,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    // Check unique constraints if name or slug is being updated
    if (dto.name || dto.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.slug ? [{ slug: dto.slug }] : []),
          ],
          NOT: { id },
        },
      });

      if (existing) {
        if (existing.name === dto.name) {
          throw new ConflictException(
            `Danh mục với tên "${dto.name}" đã tồn tại`,
          );
        }
        throw new ConflictException(
          `Danh mục với slug "${dto.slug}" đã tồn tại`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
