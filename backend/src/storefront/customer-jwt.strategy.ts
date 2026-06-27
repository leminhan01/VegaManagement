import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Payload JWT cho khách hàng storefront.
export interface CustomerJwtPayload {
  sub: string; // customer.id
  phone: string;
  role: 'customer';
}

export interface CustomerRequestUser {
  id: string;
  phone: string;
  role: 'customer';
}

/**
 * Passport strategy riêng cho khách hàng storefront, dùng secret khác với admin
 * (CUSTOMER_JWT_SECRET) để cô lập hai chiều: token khách không verify được với
 * admin strategy và ngược lại → tránh rò rỉ dữ liệu admin.
 */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'customer-jwt',
) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('CUSTOMER_JWT_SECRET') as string;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: CustomerJwtPayload): CustomerRequestUser {
    return {
      id: payload.sub,
      phone: payload.phone,
      role: 'customer',
    };
  }
}
