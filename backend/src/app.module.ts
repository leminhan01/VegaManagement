import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { ChatSessionsModule } from './chat-sessions/chat-sessions.module';
import { BotApiModule } from './bot-api/bot-api.module';
import { StatsModule } from './stats/stats.module';
import { InventoryModule } from './inventory/inventory.module';
import { StoreConfigModule } from './store-config/store-config.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CustomersModule,
    ChatSessionsModule,
    BotApiModule,
    StatsModule,
    InventoryModule,
    StoreConfigModule,
  ],
  providers: [
    // Global JWT guard — all routes require auth unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global response transform interceptor
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Global exception filters (order matters: more specific first)
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
