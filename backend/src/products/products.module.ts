import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsImportService } from './products-import.service';
import { EmbeddingSyncService } from './embeddings-sync.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductsImportService, EmbeddingSyncService],
  exports: [ProductsService, ProductsImportService, EmbeddingSyncService],
})
export class ProductsModule {}
