import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SendMailInput {
  to: string[];
  subject: string;
  html: string;
}

/**
 * Wrapper quanh nodemailer — tạo transporter Gmail SMTP từ env, verify kết nối
 * khi khởi động, và cung cấp sendMail() cho EmailReportsService.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASS chưa cấu hình — gửi email sẽ thất bại. Kiểm tra lại backend/.env',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true cho 465 (SSL), false cho 587 (STARTTLS)
      auth: { user, pass },
    });

    // Verify kết nối — không throw để app vẫn boot nếu SMTP chưa sẵn sàng.
    this.transporter
      .verify()
      .then(() => this.logger.log('Kết nối SMTP thành công'))
      .catch((err: Error) =>
        this.logger.error(`Không kết nối được SMTP: ${err.message}`),
      );
  }

  async sendMail({ to, subject, html }: SendMailInput) {
    const user = this.config.get<string>('SMTP_USER');
    const fromName = this.config.get<string>('SMTP_FROM_NAME') ?? 'Vegan Shop';

    return this.transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: to.join(', '),
      subject,
      html,
    });
  }
}
