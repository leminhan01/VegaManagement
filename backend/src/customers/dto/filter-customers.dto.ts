import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterCustomersDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Type(() => Number)
  minSpent?: number;

  @IsOptional()
  @Type(() => Number)
  maxSpent?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}
