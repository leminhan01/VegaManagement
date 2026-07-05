import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
  SemanticSearchDto,
  UpsertSessionDto,
  CreateMessageDto,
} from './dto/search-products.dto';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  BotCreateOrderDto,
  SessionQueryDto,
} from './dto/cart.dto';

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

  @Get('products/semantic-search')
  semanticSearchProducts(@Query() query: SemanticSearchDto) {
    return this.botApiService.semanticSearch(query);
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

  // ── Store Config ──────────────────────────────────────────

  @Get('store-info')
  getFullStoreInfo() {
    return this.botApiService.getFullStoreInfo();
  }

  @Get('store-config')
  getStoreConfig() {
    return this.botApiService.getStoreConfig();
  }

  @Get('store-config/:key')
  getStoreConfigByKey(@Param('key') key: string) {
    return this.botApiService.getStoreConfigByKey(key);
  }

  // ── Orders ────────────────────────────────────────────────

  @Get('orders/code/:code')
  getOrderByCode(@Param('code') code: string) {
    return this.botApiService.getOrderByCode(code);
  }

  // Tạo đơn từ giỏ hàng của phiên chat (chatbot checkout) — COD
  @Post('orders')
  createOrder(@Body() dto: BotCreateOrderDto) {
    return this.botApiService.createOrder(dto);
  }

  // ── Cart (đặt hàng qua chatbot) ───────────────────────────

  @Get('cart')
  viewCart(@Query() query: SessionQueryDto) {
    return this.botApiService.viewCart(query.sessionId);
  }

  @Post('cart/items')
  addCartItem(@Body() dto: AddCartItemDto) {
    return this.botApiService.addCartItem(dto.sessionId, dto.productId, dto.quantity);
  }

  @Put('cart/items/:productId')
  updateCartItem(
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.botApiService.updateCartItem(dto.sessionId, productId, dto.quantity);
  }

  @Delete('cart/items/:productId')
  removeCartItem(
    @Param('productId') productId: string,
    @Query() query: SessionQueryDto,
  ) {
    return this.botApiService.removeCartItem(query.sessionId, productId);
  }

  // ── Customers ─────────────────────────────────────────────

  @Get('customers/phone/:phone/orders')
  getCustomerOrders(@Param('phone') phone: string) {
    return this.botApiService.getCustomerOrders(phone);
  }

  // ── Chat Sessions (Bot) ───────────────────────────────────

  @Get('chat-sessions/:id')
  getSession(@Param('id') id: string) {
    return this.botApiService.getSession(id);
  }

  @Post('chat-sessions')
  upsertSession(@Body() dto: UpsertSessionDto) {
    return this.botApiService.upsertSession(dto);
  }

  @Post('chat-sessions/:id/messages')
  saveMessage(@Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.botApiService.saveMessage(id, dto);
  }
}
