import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { StorefrontAuthService } from './storefront-auth.service';
import { StorefrontAuthGuard } from './storefront-auth.guard';
import { CustomerJwtStrategy } from './customer-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // JwtModule riêng cho khách — secret CUSTOMER_JWT_SECRET, cô lập với admin.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('CUSTOMER_JWT_SECRET') as string,
        signOptions: { expiresIn: '15m' },
      }),
    }),
    OrdersModule,
  ],
  controllers: [StorefrontController],
  providers: [
    StorefrontService,
    StorefrontAuthService,
    CustomerJwtStrategy,
    StorefrontAuthGuard,
  ],
})
export class StorefrontModule {}
