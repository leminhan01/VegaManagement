import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateProductBatchDto {
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'EXPIRED', 'CONSUMED', 'RECALLED'])
  status?: 'ACTIVE' | 'EXPIRED' | 'CONSUMED' | 'RECALLED';
}
