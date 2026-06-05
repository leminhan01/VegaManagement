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
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { FilterInventoryDto } from './dto/filter-inventory.dto';
import { FilterStockMovementsDto } from './dto/filter-stock-movements.dto';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
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
