import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterProductsDto {
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
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') return value.split(',').map((t: string) => t.trim());
    return value;
  })
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'price', 'stock', 'sku'])
  sort?: 'createdAt' | 'updatedAt' | 'name' | 'price' | 'stock' | 'sku';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
