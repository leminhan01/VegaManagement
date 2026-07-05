import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Module email dùng chung. KHÔNG import OrdersModule (hoặc bất kỳ module
 * business nào) để tránh circular dependency — vì OrdersModule và
 * EmailReportsModule đều cần dùng MailService.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
