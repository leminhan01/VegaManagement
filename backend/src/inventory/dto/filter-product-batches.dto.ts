import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterProductBatchesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'EXPIRED', 'CONSUMED', 'RECALLED'])
  status?: 'ACTIVE' | 'EXPIRED' | 'CONSUMED' | 'RECALLED';

  @IsOptional()
  @IsString()
  expirationFrom?: string;

  @IsOptional()
  @IsString()
  expirationTo?: string;
}
