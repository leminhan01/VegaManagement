import { Module } from '@nestjs/common';
import { BotApiController } from './bot-api.controller';
import { BotApiService } from './bot-api.service';

@Module({
  controllers: [BotApiController],
  providers: [BotApiService],
  exports: [BotApiService],
})
export class BotApiModule {}
