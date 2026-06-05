import { IsOptional, IsString, IsEnum } from 'class-validator';
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
