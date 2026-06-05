import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  createPaginatedResult,
  getPaginationParams,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { FilterInventoryDto } from './dto/filter-inventory.dto';
import { FilterStockMovementsDto } from './dto/filter-stock-movements.dto';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        price: true,
        unit: true,
        category: { select: { name: true } },
      },
      orderBy: { stock: 'asc' },
    });

    const lowStockProducts = products.filter(
      (product) => product.stock > 0 && product.stock <= product.minStock,
    );
    const outOfStockProducts = products.filter((product) => product.stock === 0);
    const totalValue = products.reduce(
      (sum, product) => sum + product.stock * product.price,
      0,
    );

    const [supplierCount, recentMovements] = await Promise.all([
      this.prisma.supplier.count({ where: { isActive: true } }),
      this.prisma.stockMovement.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      totalProducts: products.length,
      totalStock: products.reduce((sum, product) => sum + product.stock, 0),
      totalValue,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      supplierCount,
      lowStockProducts: lowStockProducts.slice(0, 8),
      outOfStockProducts: outOfStockProducts.slice(0, 8),
      recentMovements,
    };
  }

  async getInventory(
    filter: FilterInventoryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.ProductWhereInput = { isActive: true };

    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { sku: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.stockStatus === 'out_of_stock') {
      where.stock = 0;
    } else if (filter.stockStatus === 'in_stock') {
      where.stock = { gt: 0 };
    }

    const orderBy = { [params.sort ?? 'updatedAt']: params.order };

    if (filter.stockStatus === 'low_stock') {
      const data = await this.prisma.product.findMany({
        where: { ...where, stock: { gt: 0 } },
        include: { category: true },
        orderBy,
      });
      const lowStock = data.filter((product) => product.stock <= product.minStock);
      const pageData = lowStock.slice(
        (params.page - 1) * params.limit,
        params.page * params.limit,
      );
      return createPaginatedResult(pageData, lowStock.length, params);
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async createMovement(dto: CreateStockMovementDto) {
    if (dto.type !== 'ADJUSTMENT' && dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, stock: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      if (dto.supplierId) {
        const supplier = await tx.supplier.findUnique({
          where: { id: dto.supplierId },
          select: { id: true },
        });
        if (!supplier) throw new NotFoundException('Supplier not found');
      }

      const beforeStock = product.stock;
      const afterStock =
        dto.type === 'IN'
          ? beforeStock + dto.quantity
          : dto.type === 'OUT'
            ? beforeStock - dto.quantity
            : dto.quantity;

      if (afterStock < 0) {
        throw new BadRequestException('Stock cannot be negative');
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          supplierId: dto.supplierId,
          type: dto.type,
          quantity: dto.quantity,
          beforeStock,
          afterStock,
          unitCost: dto.unitCost,
          reason: dto.reason,
          reference: dto.reference,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          supplier: { select: { id: true, name: true } },
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: afterStock },
      });

      return movement;
    });
  }

  async getMovements(
    filter: FilterStockMovementsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.StockMovementWhereInput = {};

    if (filter.productId) where.productId = filter.productId;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.type) where.type = filter.type;

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async getSuppliers(
    filter: FilterSuppliersDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.SupplierWhereInput = {};

    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: { _count: { select: { stockMovements: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async createSupplier(dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Supplier already exists');

    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        note: dto.note,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.findSupplier(id);

    if (dto.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existing) throw new ConflictException('Supplier already exists');
    }

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async removeSupplier(id: string) {
    await this.findSupplier(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async findSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }
}
