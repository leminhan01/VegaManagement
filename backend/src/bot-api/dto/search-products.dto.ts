import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatPlatform } from '@prisma/client';

export class SearchProductsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}

export class SuggestProductsDto {
  @IsOptional()
  @IsString()
  prefs?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}

export class SemanticSearchDto {
  @IsString()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  top_k?: number = 5;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  min_similarity?: number = 0.3;
}

export class UpsertSessionDto {
  @IsEnum(ChatPlatform)
  platform: ChatPlatform;

  @IsString()
  platformUserId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  isActive?: boolean;
}

export class CreateMessageDto {
  @IsString()
  role: string;

  @IsString()
  content: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
