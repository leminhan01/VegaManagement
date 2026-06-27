import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CustomerAuth } from '../common/decorators/customer-auth.decorator';
import { StorefrontAuthGuard } from './storefront-auth.guard';
import { StorefrontService } from './storefront.service';
import { StorefrontAuthService } from './storefront-auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { RefreshCustomerDto } from './dto/refresh-customer.dto';
import { CreateStorefrontOrderDto } from './dto/create-storefront-order.dto';
import { FilterStorefrontProductsDto } from './dto/filter-storefront-products.dto';

/**
 * API public cho landing page storefront.
 *
 * Toàn bộ controller đánh dấu @Public() để bỏ qua global JwtAuthGuard (admin).
 * StorefrontAuthGuard quyết định per-method: route @CustomerAuth() yêu cầu
 * token khách (customer-jwt, secret CUSTOMER_JWT_SECRET riêng).
 */
@Public()
@Controller('storefront')
@UseGuards(StorefrontAuthGuard)
export class StorefrontController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly authService: StorefrontAuthService,
  ) {}

  // ── Sản phẩm & danh mục (public) ────────────────

  @Get('products')
  findProducts(@Query() filter: FilterStorefrontProductsDto) {
    return this.storefrontService.findPublishedProducts(filter);
  }

  @Get('products/:slug')
  findProduct(@Param('slug') slug: string) {
    return this.storefrontService.findPublishedProductBySlug(slug);
  }

  @Get('categories')
  findCategories() {
    return this.storefrontService.findActiveCategories();
  }

  // ── Auth khách (public) ─────────────────────────

  @Post('auth/register')
  register(@Body() dto: RegisterCustomerDto) {
    return this.authService.register(dto);
  }

  @Post('auth/login')
  login(@Body() dto: LoginCustomerDto) {
    return this.authService.login(dto);
  }

  @Post('auth/refresh')
  refresh(@Body() dto: RefreshCustomerDto) {
    return this.authService.refresh(dto);
  }

  // ── Tài khoản khách (cần đăng nhập) ─────────────

  @CustomerAuth()
  @Get('me')
  me(@Req() req: Request) {
    return this.authService.getProfile(req.customer!.id);
  }

  // ── Đơn hàng của khách (cần đăng nhập) ──────────

  @CustomerAuth()
  @Get('orders')
  myOrders(
    @Req() req: Request,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.storefrontService.findMyOrders(req.customer!.id, query);
  }

  @CustomerAuth()
  @Get('orders/:id')
  myOrder(@Req() req: Request, @Param('id') id: string) {
    return this.storefrontService.findMyOrder(req.customer!.id, id);
  }

  @CustomerAuth()
  @Post('orders')
  createOrder(@Req() req: Request, @Body() dto: CreateStorefrontOrderDto) {
    return this.storefrontService.createOrder(req.customer!.id, dto);
  }
}
