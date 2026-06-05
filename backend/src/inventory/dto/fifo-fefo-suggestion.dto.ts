import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FifoFefoSuggestionDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
