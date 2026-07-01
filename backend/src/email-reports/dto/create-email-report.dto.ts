import {
  IsArray,
  ArrayMinSize,
  IsEmail,
  IsInt,
  IsIn,
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { SECTION_WHITELIST } from '../constants';

export class CreateEmailReportDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  recipients!: string[];

  @IsInt()
  @Min(1)
  @Max(720) // tối đa 30 ngày
  intervalHours!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...SECTION_WHITELIST], { each: true })
  sections!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
