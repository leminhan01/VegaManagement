import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() filter: FilterOrdersDto) {
    return this.ordersService.findAll(filter);
  }

  @Get('report/summary')
  getReport(@Query() filter: FilterOrdersDto) {
    return this.ordersService.getReport(filter);
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.ordersService.findByCode(code);
  }

  @Get(':id/invoice')
  getInvoice(@Param('id') id: string) {
    return this.ordersService.getInvoice(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }

  @Patch(':id/refund')
  refund(@Param('id') id: string) {
    return this.ordersService.refund(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
