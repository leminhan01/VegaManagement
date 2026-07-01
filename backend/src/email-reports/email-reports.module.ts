import { Module } from '@nestjs/common';
import { EmailReportsController } from './email-reports.controller';
import { EmailReportsService } from './email-reports.service';
import { MailService } from './mail.service';
import { StatsModule } from '../stats/stats.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [StatsModule, OrdersModule],
  controllers: [EmailReportsController],
  providers: [EmailReportsService, MailService],
  exports: [MailService],
})
export class EmailReportsModule {}
