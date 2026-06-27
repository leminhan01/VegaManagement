import { SetMetadata } from '@nestjs/common';

// Metadata key đánh dấu route storefront yêu cầu khách đã đăng nhập.
// StorefrontAuthGuard đọc key này để quyết định có validate customer-jwt hay không.
export const REQUIRES_CUSTOMER_KEY = 'requiresCustomer';
export const CustomerAuth = () => SetMetadata(REQUIRES_CUSTOMER_KEY, true);
