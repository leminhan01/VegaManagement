import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.statsService.getDashboardStats();
  }

  @Get('inventory-value')
  getInventoryValueReport() {
    return this.statsService.getInventoryValueReport();
  }

  @Get('expiration')
  getExpirationReport(@Query('daysThreshold') daysThreshold?: string) {
    return this.statsService.getExpirationReport(Number(daysThreshold) || 30);
  }

  @Get('stock-movements')
  getStockMovementReport(@Query('days') days?: string) {
    return this.statsService.getStockMovementReport(Number(days) || 30);
  }

  @Get('batches')
  getBatchReport() {
    return this.statsService.getBatchReport();
  }

  @Get('inventory-advanced')
  getAdvancedInventoryReport() {
    return this.statsService.getAdvancedInventoryReport();
  }
}
