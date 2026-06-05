import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class BotApiGuard implements CanActivate {
  private readonly logger = new Logger(BotApiGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const expectedKey = this.configService.get<string>('BOT_API_KEY');

    if (!apiKey || apiKey !== expectedKey) {
      this.logger.warn(`Xác thực API key thất bại từ ${request.ip}`);
      throw new UnauthorizedException('API key không hợp lệ hoặc bị thiếu');
    }

    return true;
  }
}
