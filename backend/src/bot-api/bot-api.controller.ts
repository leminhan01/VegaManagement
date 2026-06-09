import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { BotApiGuard } from './bot-api.guard';
import { BotApiService } from './bot-api.service';
import { Public } from '../common/decorators/public.decorator';
import {
  SearchProductsDto,
  SuggestProductsDto,
  UpsertSessionDto,
  CreateMessageDto,
} from './dto/search-products.dto';

@Public()
@UseGuards(BotApiGuard)
@Controller('bot')
@ApiSecurity('BOT_API_KEY')
export class BotApiController {
  constructor(private readonly botApiService: BotApiService) {}

  // ── Products ──────────────────────────────────────────────

  @Get('products')
  searchProducts(@Query() query: SearchProductsDto) {
    return this.botApiService.searchProducts(query);
  }

  @Get('products/suggest')
  suggestProducts(@Query() query: SuggestProductsDto) {
    return this.botApiService.suggestProducts(query);
  }

  @Get('products/:id')
  getProductDetail(@Param('id') id: string) {
    return this.botApiService.getProductDetail(id);
  }

  @Get('products/:id/stock')
  getStock(@Param('id') id: string) {
    return this.botApiService.getStock(id);
  }

  // ── Categories ────────────────────────────────────────────

  @Get('categories')
  getCategories() {
    return this.botApiService.getCategories();
  }

  // ── Orders ────────────────────────────────────────────────

  @Get('orders/code/:code')
  getOrderByCode(@Param('code') code: string) {
    return this.botApiService.getOrderByCode(code);
  }

  // ── Customers ─────────────────────────────────────────────

  @Get('customers/phone/:phone/orders')
  getCustomerOrders(@Param('phone') phone: string) {
    return this.botApiService.getCustomerOrders(phone);
  }

  // ── Chat Sessions (Bot) ───────────────────────────────────

  @Post('chat-sessions')
  upsertSession(@Body() dto: UpsertSessionDto) {
    return this.botApiService.upsertSession(dto);
  }

  @Post('chat-sessions/:id/messages')
  saveMessage(@Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.botApiService.saveMessage(id, dto);
  }
}
