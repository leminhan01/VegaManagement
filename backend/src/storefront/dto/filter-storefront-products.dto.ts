import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

/**
 * Filter sản phẩm public trên storefront. Subset của admin FilterProductsDto —
 * không cho filter theo isActive/isPublished (luôn ép true ở service).
 */
export class FilterStorefrontProductsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  sort?: 'createdAt' | 'name' | 'price';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}
