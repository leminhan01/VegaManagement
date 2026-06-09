import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateStockAuditDto } from './dto/create-stock-audit.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateProductBatchDto } from './dto/create-product-batch.dto';
import { FilterActionLogsDto } from './dto/filter-action-logs.dto';
import { FilterExpirationAlertsDto } from './dto/filter-expiration-alerts.dto';
import { FilterInventoryDto } from './dto/filter-inventory.dto';
import { FilterProductBatchesDto } from './dto/filter-product-batches.dto';
import { FilterStockAuditsDto } from './dto/filter-stock-audits.dto';
import { FilterStockMovementsDto } from './dto/filter-stock-movements.dto';
import { FilterStockTransfersDto } from './dto/filter-stock-transfers.dto';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto';
import { FifoFefoSuggestionDto } from './dto/fifo-fefo-suggestion.dto';
import { BatchConsumptionDto } from './dto/batch-consumption.dto';
import { UpdateProductBatchDto } from './dto/update-product-batch.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@ApiBearerAuth('access_token')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('products')
  getInventory(@Query() filter: FilterInventoryDto) {
    return this.inventoryService.getInventory(filter);
  }

  @Get('movements')
  getMovements(@Query() filter: FilterStockMovementsDto) {
    return this.inventoryService.getMovements(filter);
  }

  @Post('movements')
  createMovement(@Body() dto: CreateStockMovementDto) {
    return this.inventoryService.createMovement(dto);
  }

  @Get('batches')
  getBatches(@Query() filter: FilterProductBatchesDto) {
    return this.inventoryService.getBatches(filter);
  }

  @Post('batches')
  createBatch(@Body() dto: CreateProductBatchDto) {
    return this.inventoryService.createBatch(dto);
  }

  @Patch('batches/:id')
  updateBatch(@Param('id') id: string, @Body() dto: UpdateProductBatchDto) {
    return this.inventoryService.updateBatch(id, dto);
  }

  @Patch('batches/:id/expire')
  expireBatch(@Param('id') id: string) {
    return this.inventoryService.expireBatch(id);
  }

  @Get('expiration-alerts')
  getExpirationAlerts(@Query() filter: FilterExpirationAlertsDto) {
    return this.inventoryService.getExpirationAlerts(filter);
  }

  @Get('fifo-fefo-suggestion')
  getFifoFefoSuggestion(@Query() dto: FifoFefoSuggestionDto) {
    return this.inventoryService.getFifoFefoSuggestion(dto);
  }

  @Post('batches/consume')
  consumeBatches(@Body() dto: BatchConsumptionDto) {
    return this.inventoryService.consumeBatches(dto);
  }

  @Get('warehouses')
  getWarehouses() {
    return this.inventoryService.getWarehouses();
  }

  @Post('warehouses')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(dto);
  }

  @Get('transfers')
  getTransfers(@Query() filter: FilterStockTransfersDto) {
    return this.inventoryService.getTransfers(filter);
  }

  @Post('transfers')
  createTransfer(@Body() dto: CreateStockTransferDto) {
    return this.inventoryService.createTransfer(dto);
  }

  @Get('audits')
  getAudits(@Query() filter: FilterStockAuditsDto) {
    return this.inventoryService.getAudits(filter);
  }

  @Post('audits')
  createAudit(@Body() dto: CreateStockAuditDto) {
    return this.inventoryService.createAudit(dto);
  }

  @Get('action-logs')
  getActionLogs(@Query() filter: FilterActionLogsDto) {
    return this.inventoryService.getActionLogs(filter);
  }

  @Get('suppliers')
  getSuppliers(@Query() filter: FilterSuppliersDto) {
    return this.inventoryService.getSuppliers(filter);
  }

  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.inventoryService.createSupplier(dto);
  }

  @Put('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.inventoryService.updateSupplier(id, dto);
  }

  @Patch('suppliers/:id/archive')
  removeSupplier(@Param('id') id: string) {
    return this.inventoryService.removeSupplier(id);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@Param('id') id: string) {
    return this.inventoryService.removeSupplier(id);
  }
}
