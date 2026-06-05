import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã xảy ra lỗi cơ sở dữ liệu. Vui lòng thử lại sau.';

    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation
        statusCode = HttpStatus.CONFLICT;
        const fields = (exception.meta?.target as string[])?.join(', ') ?? 'field';
        message = `Giá trị đã tồn tại cho: ${fields}. Vui lòng sử dụng giá trị khác.`;
        break;
      }
      case 'P2025': {
        // Record not found
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Không tìm thấy bản ghi yêu cầu.';
        break;
      }
      case 'P2003': {
        // Foreign key constraint failure
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Tham chiếu đến bản ghi không tồn tại. Vui lòng kiểm tra lại dữ liệu.';
        break;
      }
      default: {
        // Log the full error internally but never expose to client
        this.logger.error(
          `Prisma error [${exception.code}]: ${exception.message}`,
          exception.stack,
        );
        break;
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
