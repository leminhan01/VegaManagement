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
import { CreateStockAuditDto } from './dto/create-stock-audit.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateProductBatchDto } from './dto/create-product-batch.dto';
import { FilterActionLogsDto } from './dto/filter-action-logs.dto';
import { FilterInventoryDto } from './dto/filter-inventory.dto';
import { FilterStockAuditsDto } from './dto/filter-stock-audits.dto';
import { FilterStockMovementsDto } from './dto/filter-stock-movements.dto';
import { FilterStockTransfersDto } from './dto/filter-stock-transfers.dto';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto';
import { FilterProductBatchesDto } from './dto/filter-product-batches.dto';
import { FilterExpirationAlertsDto } from './dto/filter-expiration-alerts.dto';
import { UpdateProductBatchDto } from './dto/update-product-batch.dto';
import { FifoFefoSuggestionDto } from './dto/fifo-fefo-suggestion.dto';
import { BatchConsumptionDto } from './dto/batch-consumption.dto';
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

    const [supplierCount, warehouseCount, pendingAuditCount, recentMovements] = await Promise.all([
      this.prisma.supplier.count({ where: { isActive: true } }),
      this.prisma.warehouse.count({ where: { isActive: true } }),
      this.prisma.stockAudit.count({ where: { status: 'DRAFT' } }),
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
      warehouseCount,
      pendingAuditCount,
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

      await this.logAction(tx, {
        action:
          dto.type === 'IN'
            ? 'STOCK_IN'
            : dto.type === 'OUT'
              ? 'STOCK_OUT'
              : 'STOCK_ADJUST',
        entityType: 'StockMovement',
        entityId: movement.id,
        message: `${dto.type} ${dto.quantity} product units`,
        metadata: {
          productId: dto.productId,
          supplierId: dto.supplierId,
          beforeStock,
          afterStock,
          reference: dto.reference,
        },
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

    const supplier = await this.prisma.supplier.create({
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

    await this.logAction(this.prisma, {
      action: 'SUPPLIER_CREATE',
      entityType: 'Supplier',
      entityId: supplier.id,
      message: `Created supplier ${supplier.name}`,
      metadata: { name: supplier.name },
    });

    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.findSupplier(id);

    if (dto.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existing) throw new ConflictException('Supplier already exists');
    }

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: dto,
    });

    await this.logAction(this.prisma, {
      action: 'SUPPLIER_UPDATE',
      entityType: 'Supplier',
      entityId: supplier.id,
      message: `Updated supplier ${supplier.name}`,
      metadata: dto as Prisma.InputJsonObject,
    });

    return supplier;
  }

  async removeSupplier(id: string) {
    await this.findSupplier(id);
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    await this.logAction(this.prisma, {
      action: 'SUPPLIER_ARCHIVE',
      entityType: 'Supplier',
      entityId: supplier.id,
      message: `Archived supplier ${supplier.name}`,
      metadata: { name: supplier.name },
    });

    return supplier;
  }

  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      include: { _count: { select: { stocks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWarehouse(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException('Warehouse code already exists');

    const warehouse = await this.prisma.warehouse.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        note: dto.note,
        isActive: dto.isActive ?? true,
      },
    });

    await this.logAction(this.prisma, {
      action: 'WAREHOUSE_CREATE',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      message: `Created warehouse ${warehouse.name}`,
      metadata: { code: warehouse.code },
    });

    return warehouse;
  }

  async getTransfers(
    filter: FilterStockTransfersDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.StockTransferWhereInput = {};
    if (filter.productId) where.productId = filter.productId;
    if (filter.warehouseId) {
      where.OR = [
        { fromWarehouseId: filter.warehouseId },
        { toWarehouseId: filter.warehouseId },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async createTransfer(dto: CreateStockTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Warehouses must be different');
    }

    return this.prisma.$transaction(async (tx) => {
      const [product, fromWarehouse, toWarehouse] = await Promise.all([
        tx.product.findUnique({
          where: { id: dto.productId },
          select: { id: true, stock: true },
        }),
        tx.warehouse.findUnique({ where: { id: dto.fromWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: dto.toWarehouseId } }),
      ]);

      if (!product) throw new NotFoundException('Product not found');
      if (!fromWarehouse || !toWarehouse) {
        throw new NotFoundException('Warehouse not found');
      }

      const fromStock = await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: dto.fromWarehouseId,
            productId: dto.productId,
          },
        },
        update: {},
        create: {
          warehouseId: dto.fromWarehouseId,
          productId: dto.productId,
          stock: product.stock,
        },
      });

      if (fromStock.stock < dto.quantity) {
        throw new BadRequestException('Source warehouse stock is not enough');
      }

      await tx.warehouseStock.update({
        where: { id: fromStock.id },
        data: { stock: fromStock.stock - dto.quantity },
      });

      await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: dto.toWarehouseId,
            productId: dto.productId,
          },
        },
        update: { stock: { increment: dto.quantity } },
        create: {
          warehouseId: dto.toWarehouseId,
          productId: dto.productId,
          stock: dto.quantity,
        },
      });

      const transfer = await tx.stockTransfer.create({
        data: {
          transferCode: await this.nextCode(tx, 'TRF'),
          productId: dto.productId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          quantity: dto.quantity,
          reason: dto.reason,
          reference: dto.reference,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
        },
      });

      await this.logAction(tx, {
        action: 'STOCK_TRANSFER',
        entityType: 'StockTransfer',
        entityId: transfer.id,
        message: `Transferred ${dto.quantity} product units`,
        metadata: {
          productId: dto.productId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
        },
      });

      return transfer;
    });
  }

  async getAudits(
    filter: FilterStockAuditsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.StockAuditWhereInput = {};
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.status) where.status = filter.status;

    const [data, total] = await Promise.all([
      this.prisma.stockAudit.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.stockAudit.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async createAudit(dto: CreateStockAuditDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.warehouseId) {
        const warehouse = await tx.warehouse.findUnique({
          where: { id: dto.warehouseId },
        });
        if (!warehouse) throw new NotFoundException('Warehouse not found');
      }

      const productIds = [...new Set(dto.items.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products not found');
      }
      const stockMap = new Map(products.map((product) => [product.id, product.stock]));

      const audit = await tx.stockAudit.create({
        data: {
          auditCode: await this.nextCode(tx, 'AUD'),
          warehouseId: dto.warehouseId,
          note: dto.note,
          status: 'COMPLETED',
          completedAt: new Date(),
          items: {
            create: dto.items.map((item) => {
              const systemStock = stockMap.get(item.productId) ?? 0;
              return {
                productId: item.productId,
                systemStock,
                countedStock: item.countedStock,
                difference: item.countedStock - systemStock,
                note: item.note,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const item of audit.items) {
        if (item.difference === 0) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: item.countedStock },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'ADJUSTMENT',
            quantity: item.countedStock,
            beforeStock: item.systemStock,
            afterStock: item.countedStock,
            reason: `Stock audit ${audit.auditCode}`,
            reference: audit.auditCode,
          },
        });
      }

      await this.logAction(tx, {
        action: 'STOCK_AUDIT',
        entityType: 'StockAudit',
        entityId: audit.id,
        message: `Completed stock audit ${audit.auditCode}`,
        metadata: {
          auditCode: audit.auditCode,
          itemCount: audit.items.length,
          warehouseId: dto.warehouseId,
        },
      });

      return tx.stockAudit.findUnique({
        where: { id: audit.id },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
        },
      });
    });
  }

  async getActionLogs(
    filter: FilterActionLogsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.InventoryActionLogWhereInput = {};
    if (filter.action) where.action = filter.action;

    const [data, total] = await Promise.all([
      this.prisma.inventoryActionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.inventoryActionLog.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async getBatches(
    filter: FilterProductBatchesDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const params = getPaginationParams(filter);
    const where: Prisma.ProductBatchWhereInput = {};

    if (filter.productId) where.productId = filter.productId;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { batchCode: { contains: filter.search, mode: 'insensitive' } },
        { product: { name: { contains: filter.search, mode: 'insensitive' } } },
        { product: { sku: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }
    if (filter.expirationFrom || filter.expirationTo) {
      where.expirationDate = {
        ...(filter.expirationFrom && { gte: new Date(filter.expirationFrom) }),
        ...(filter.expirationTo && { lte: new Date(filter.expirationTo) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.productBatch.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          supplier: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ status: 'asc' }, { expirationDate: 'asc' }, { receivedAt: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.productBatch.count({ where }),
    ]);

    return createPaginatedResult(data, total, params);
  }

  async createBatch(dto: CreateProductBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const [product, supplier, warehouse] = await Promise.all([
        tx.product.findUnique({ where: { id: dto.productId } }),
        dto.supplierId
          ? tx.supplier.findUnique({ where: { id: dto.supplierId } })
          : Promise.resolve(null),
        dto.warehouseId
          ? tx.warehouse.findUnique({ where: { id: dto.warehouseId } })
          : Promise.resolve(null),
      ]);

      if (!product) throw new NotFoundException('Product not found');
      if (dto.supplierId && !supplier) throw new NotFoundException('Supplier not found');
      if (dto.warehouseId && !warehouse) throw new NotFoundException('Warehouse not found');

      const beforeStock = product.stock;
      const afterStock = beforeStock + dto.initialQuantity;

      const batch = await tx.productBatch.create({
        data: {
          batchCode: await this.nextCode(tx, 'BCH'),
          productId: dto.productId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          initialQuantity: dto.initialQuantity,
          remainingQty: dto.initialQuantity,
          unitCost: dto.unitCost,
          expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
          manufactureDate: dto.manufactureDate
            ? new Date(dto.manufactureDate)
            : undefined,
          note: dto.note,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          supplier: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          supplierId: dto.supplierId,
          batchId: batch.id,
          type: 'IN',
          quantity: dto.initialQuantity,
          beforeStock,
          afterStock,
          unitCost: dto.unitCost,
          reason: `Batch ${batch.batchCode}`,
          reference: batch.batchCode,
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: afterStock },
      });

      if (dto.warehouseId) {
        await tx.warehouseStock.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: dto.warehouseId,
              productId: dto.productId,
            },
          },
          update: { stock: { increment: dto.initialQuantity } },
          create: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            stock: dto.initialQuantity,
          },
        });
      }

      await this.logAction(tx, {
        action: 'BATCH_CREATE',
        entityType: 'ProductBatch',
        entityId: batch.id,
        message: `Created batch ${batch.batchCode}`,
        metadata: {
          productId: dto.productId,
          movementId: movement.id,
          quantity: dto.initialQuantity,
          expirationDate: dto.expirationDate,
        },
      });

      return batch;
    });
  }

  async updateBatch(id: string, dto: UpdateProductBatchDto) {
    await this.findBatch(id);
    const batch = await this.prisma.productBatch.update({
      where: { id },
      data: {
        ...(dto.expirationDate !== undefined && {
          expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
        }),
        ...(dto.manufactureDate !== undefined && {
          manufactureDate: dto.manufactureDate ? new Date(dto.manufactureDate) : null,
        }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    await this.logAction(this.prisma, {
      action: dto.status === 'EXPIRED' ? 'BATCH_EXPIRE' : 'BATCH_CREATE',
      entityType: 'ProductBatch',
      entityId: batch.id,
      message: `Updated batch ${batch.batchCode}`,
      metadata: dto as Prisma.InputJsonObject,
    });

    return batch;
  }

  async expireBatch(id: string) {
    const batch = await this.findBatch(id);
    if (batch.status === 'EXPIRED') return batch;

    const updated = await this.prisma.productBatch.update({
      where: { id },
      data: { status: 'EXPIRED' },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    await this.logAction(this.prisma, {
      action: 'BATCH_EXPIRE',
      entityType: 'ProductBatch',
      entityId: updated.id,
      message: `Marked batch ${updated.batchCode} as expired`,
      metadata: { batchCode: updated.batchCode },
    });

    return updated;
  }

  async getExpirationAlerts(filter: FilterExpirationAlertsDto) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(now.getDate() + (filter.daysThreshold ?? 30));

    const where: Prisma.ProductBatchWhereInput = {
      remainingQty: { gt: 0 },
      status: 'ACTIVE',
      expirationDate: { not: null, lte: threshold },
    };
    if (filter.productId) where.productId = filter.productId;
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;

    const batches = await this.prisma.productBatch.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    return batches.map((batch) => {
      const expirationTime = batch.expirationDate?.getTime() ?? now.getTime();
      const daysUntilExpiration = Math.ceil(
        (expirationTime - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        ...batch,
        daysUntilExpiration,
        alertLevel:
          daysUntilExpiration < 0
            ? 'expired'
            : daysUntilExpiration <= 7
              ? 'critical'
              : 'warning',
      };
    });
  }

  async getFifoFefoSuggestion(dto: FifoFefoSuggestionDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const strategy =
      product.fulfillmentStrategy ?? product.category.fulfillmentStrategy ?? 'FIFO';

    const candidates = await this.getAvailableBatches(dto.productId, dto.warehouseId);
    const ordered = this.sortBatchesForStrategy(candidates, strategy);

    let remaining = dto.quantity;
    const allocations: Array<Record<string, unknown>> = [];
    for (const batch of ordered) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, batch.remainingQty);
      allocations.push({
        batchId: batch.id,
        batchCode: batch.batchCode,
        quantity,
        remainingQty: batch.remainingQty,
        expirationDate: batch.expirationDate,
        receivedAt: batch.receivedAt,
        warehouse: batch.warehouse,
      });
      remaining -= quantity;
    }

    return {
      strategy,
      requestedQuantity: dto.quantity,
      availableQuantity: ordered.reduce((sum, batch) => sum + batch.remainingQty, 0),
      shortage: remaining,
      allocations,
    };
  }

  async consumeBatches(dto: BatchConsumptionDto) {
    if (dto.items.length === 0) {
      throw new BadRequestException('At least one batch allocation is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, stock: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      const totalQuantity = dto.items.reduce((sum, item) => sum + item.quantity, 0);
      if (product.stock < totalQuantity) {
        throw new BadRequestException('Product stock is not enough');
      }

      const batchIds = dto.items.map((item) => item.batchId);
      const batches = await tx.productBatch.findMany({
        where: { id: { in: batchIds }, productId: dto.productId },
      });
      if (batches.length !== batchIds.length) {
        throw new NotFoundException('One or more batches not found');
      }

      const batchMap = new Map(batches.map((batch) => [batch.id, batch]));
      for (const item of dto.items) {
        const batch = batchMap.get(item.batchId);
        if (!batch) throw new NotFoundException('Batch not found');
        if (batch.status !== 'ACTIVE') {
          throw new BadRequestException(`Batch ${batch.batchCode} is not active`);
        }
        if (batch.remainingQty < item.quantity) {
          throw new BadRequestException(`Batch ${batch.batchCode} stock is not enough`);
        }
      }

      const beforeStock = product.stock;
      const afterStock = beforeStock - totalQuantity;
      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          type: 'OUT',
          quantity: totalQuantity,
          beforeStock,
          afterStock,
          reason: dto.reason,
          reference: dto.reference,
        },
      });

      for (const item of dto.items) {
        const batch = batchMap.get(item.batchId)!;
        const remainingQty = batch.remainingQty - item.quantity;
        await tx.productBatch.update({
          where: { id: item.batchId },
          data: {
            remainingQty,
            status: remainingQty === 0 ? 'CONSUMED' : batch.status,
          },
        });
        await tx.batchStockMovement.create({
          data: {
            batchId: item.batchId,
            movementId: movement.id,
            quantity: item.quantity,
          },
        });
      }

      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: afterStock },
      });

      if (dto.warehouseId) {
        await tx.warehouseStock.updateMany({
          where: { warehouseId: dto.warehouseId, productId: dto.productId },
          data: { stock: { decrement: totalQuantity } },
        });
      }

      await this.logAction(tx, {
        action: 'BATCH_CONSUME',
        entityType: 'StockMovement',
        entityId: movement.id,
        message: `Consumed ${totalQuantity} units by batch allocation`,
        metadata: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          items: dto.items.map((item) => ({
            batchId: item.batchId,
            quantity: item.quantity,
          })),
          reference: dto.reference,
        },
      });

      return tx.stockMovement.findUnique({
        where: { id: movement.id },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          batchAllocations: {
            include: {
              batch: {
                include: {
                  warehouse: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
        },
      });
    });
  }

  private async findSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async findBatch(id: string) {
    const batch = await this.prisma.productBatch.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  private async getAvailableBatches(productId: string, warehouseId?: string) {
    return this.prisma.productBatch.findMany({
      where: {
        productId,
        ...(warehouseId && { warehouseId }),
        status: 'ACTIVE',
        remainingQty: { gt: 0 },
      },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
  }

  private sortBatchesForStrategy<
    T extends { receivedAt: Date; expirationDate: Date | null },
  >(batches: T[], strategy: 'FIFO' | 'FEFO') {
    return [...batches].sort((a, b) => {
      if (strategy === 'FEFO') {
        const aExpiry = a.expirationDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bExpiry = b.expirationDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      }
      return a.receivedAt.getTime() - b.receivedAt.getTime();
    });
  }

  private async nextCode(
    tx: Prisma.TransactionClient,
    prefix: 'AUD' | 'TRF' | 'BCH',
  ): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let count: number;
    if (prefix === 'AUD') {
      count = await tx.stockAudit.count();
    } else if (prefix === 'TRF') {
      count = await tx.stockTransfer.count();
    } else {
      count = await tx.productBatch.count();
    }
    return `${prefix}-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  private async logAction(
    client: Prisma.TransactionClient | PrismaService,
    data: {
      action: Prisma.InventoryActionLogCreateInput['action'];
      entityType: string;
      entityId?: string;
      message: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await client.inventoryActionLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        message: data.message,
        metadata: data.metadata ?? undefined,
      },
    });
  }
}
