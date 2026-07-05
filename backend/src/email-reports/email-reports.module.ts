import { Module } from '@nestjs/common';
import { EmailReportsController } from './email-reports.controller';
import { EmailReportsService } from './email-reports.service';
import { MailModule } from '../mail/mail.module';
import { StatsModule } from '../stats/stats.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [StatsModule, OrdersModule, MailModule],
  controllers: [EmailReportsController],
  providers: [EmailReportsService],
})
export class EmailReportsModule {}
