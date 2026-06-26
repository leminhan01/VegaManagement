import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { EmbeddingSyncService } from './embeddings-sync.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, EmbeddingSyncService],
  exports: [ProductsService, EmbeddingSyncService],
})
export class ProductsModule {}
