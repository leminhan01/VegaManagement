import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Query() filter: FilterCustomersDto) {
    return this.customersService.findAll(filter);
  }

  @Get('groups')
  getGroups() {
    return this.customersService.getGroups();
  }

  @Get(':id/orders')
  getOrders(@Param('id') id: string, @Query() filter: FilterCustomersDto) {
    return this.customersService.getOrders(id, filter);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.customersService.getStats(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
