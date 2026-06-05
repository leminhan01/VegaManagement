import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterActionLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsIn([
    'STOCK_IN',
    'STOCK_OUT',
    'STOCK_ADJUST',
    'STOCK_AUDIT',
    'STOCK_TRANSFER',
    'SUPPLIER_CREATE',
    'SUPPLIER_UPDATE',
    'SUPPLIER_ARCHIVE',
    'WAREHOUSE_CREATE',
    'WAREHOUSE_UPDATE',
    'BATCH_CREATE',
    'BATCH_EXPIRE',
    'BATCH_CONSUME',
  ])
  action?:
    | 'STOCK_IN'
    | 'STOCK_OUT'
    | 'STOCK_ADJUST'
    | 'STOCK_AUDIT'
    | 'STOCK_TRANSFER'
    | 'SUPPLIER_CREATE'
    | 'SUPPLIER_UPDATE'
    | 'SUPPLIER_ARCHIVE'
    | 'WAREHOUSE_CREATE'
    | 'WAREHOUSE_UPDATE'
    | 'BATCH_CREATE'
    | 'BATCH_EXPIRE'
    | 'BATCH_CONSUME';
}
