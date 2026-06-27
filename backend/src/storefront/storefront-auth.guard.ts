import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CustomerRequestUser } from './customer-jwt.strategy';
import { REQUIRES_CUSTOMER_KEY } from '../common/decorators/customer-auth.decorator';

declare module 'express' {
  // Mở rộng Request để truy cập khách hàng đã đăng nhập trong controller storefront.
  interface Request {
    customer?: CustomerRequestUser;
  }
}

/**
 * Guard cho StorefrontController:
 * - Route public (không có @CustomerAuth()) → cho qua luôn (sản phẩm/danh mục/auth).
 * - Route @CustomerAuth() → validate customer-jwt token, gắn request.customer.
 *
 * Toàn bộ StorefrontController được đánh dấu @Public() để bỏ qua global JwtAuthGuard
 * (guard admin); guard này lo phần xác thực khách. Token khách dùng secret khác
 * (CUSTOMER_JWT_SECRET) nên không thể dùng để truy cập route admin.
 */
@Injectable()
export class StorefrontAuthGuard extends AuthGuard('customer-jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const requiresCustomer = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_CUSTOMER_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Endpoint public của storefront — không cần auth.
    if (!requiresCustomer) {
      return true;
    }

    // Endpoint yêu cầu khách — chạy passport customer-jwt.
    return super.canActivate(context);
  }

  handleRequest(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): any {
    if (err || !user) {
      throw new UnauthorizedException(
        'Vui lòng đăng nhập để thực hiện thao tác này',
      );
    }
    const validated = user as CustomerRequestUser;
    // Gắn khách lên request để controller dùng qua @Req().
    const request = context.switchToHttp().getRequest<import('express').Request>();
    request.customer = validated;
    return validated;
  }
}
