import { Module } from '@nestjs/common';
import { BotApiController } from './bot-api.controller';
import { BotApiService } from './bot-api.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [BotApiController],
  providers: [BotApiService],
  exports: [BotApiService],
})
export class BotApiModule {}
