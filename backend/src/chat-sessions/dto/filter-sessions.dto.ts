import { IsOptional, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatPlatform } from '@prisma/client';

export class FilterSessionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(ChatPlatform)
  platform?: ChatPlatform;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
