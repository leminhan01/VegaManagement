import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BatchConsumptionItem {
  @IsString()
  batchId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class BatchConsumptionDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchConsumptionItem)
  items!: BatchConsumptionItem[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
