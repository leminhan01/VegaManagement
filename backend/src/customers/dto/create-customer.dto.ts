import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  shippingAddresses?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  group?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
