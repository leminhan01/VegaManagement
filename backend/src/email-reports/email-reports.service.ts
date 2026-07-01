import { Cron } from '@nestjs/schedule';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { OrdersService } from '../orders/orders.service';
import { MailService } from './mail.service';
import {
  buildReportHtml,
  buildReportSubject,
  type ReportData,
} from './email-template.builder';
import { CreateEmailReportDto } from './dto/create-email-report.dto';
import { UpdateEmailReportDto } from './dto/update-email-report.dto';

@Injectable()
export class EmailReportsService {
  private readonly logger = new Logger(EmailReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statsService: StatsService,
    private readonly ordersService: OrdersService,
    private readonly mailService: MailService,
  ) {}

  // ── CRUD ──

  findAll() {
    return this.prisma.emailReportConfig.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    });
  }

  async findOne(id: string) {
    const config = await this.prisma.emailReportConfig.findUnique({
      where: { id },
      include: { logs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!config) throw new NotFoundException(`Email report config ${id} not found`);
    return config;
  }

  create(dto: CreateEmailReportDto) {
    const now = new Date();
    const nextRunAt = this.computeNextRun(null, dto.intervalHours, now);
    return this.prisma.emailReportConfig.create({
      data: {
        name: dto.name,
        recipients: dto.recipients,
        intervalHours: dto.intervalHours,
        sections: dto.sections,
        isActive: dto.isActive ?? true,
        nextRunAt,
      },
    });
  }

  async update(id: string, dto: UpdateEmailReportDto) {
    const existing = await this.prisma.emailReportConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Email report config ${id} not found`);

    // Nếu đổi chu kỳ → tính lại nextRunAt từ lastSentAt (hoặc now).
    let nextRunAt = existing.nextRunAt;
    if (dto.intervalHours !== undefined && dto.intervalHours !== existing.intervalHours) {
      nextRunAt = this.computeNextRun(existing.lastSentAt, dto.intervalHours, new Date());
    }

    return this.prisma.emailReportConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.recipients !== undefined && { recipients: dto.recipients }),
        ...(dto.intervalHours !== undefined && { intervalHours: dto.intervalHours }),
        ...(dto.sections !== undefined && { sections: dto.sections }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        nextRunAt,
      },
    });
  }

  async toggle(id: string) {
    const existing = await this.prisma.emailReportConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Email report config ${id} not found`);
    return this.prisma.emailReportConfig.update({
      where: { id },
      data: {
        isActive: !existing.isActive,
        // Khi bật lại: đặt nextRunAt từ now để sớm được cron tick xử lý.
        ...(!existing.isActive && { nextRunAt: this.computeNextRun(null, existing.intervalHours, new Date()) }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.emailReportConfig.delete({ where: { id } });
  }

  // ── Cron: quét các cấu hình đến hạn mỗi 10 phút ──

  @Cron('*/10 * * * *')
  async processDueReports() {
    const due = await this.prisma.emailReportConfig.findMany({
      where: { isActive: true, nextRunAt: { lte: new Date() } },
    });
    if (!due.length) return;

    this.logger.log(`Cron tick: ${due.length} báo cáo đến hạn`);
    for (const config of due) {
      try {
        await this.sendReport(config.id);
      } catch (err) {
        // Lỗi từng config không làm gián đoạn các config khác.
        this.logger.error(
          `Gửi báo cáo ${config.id} thất bại: ${err instanceof Error ? err.message : String(err)}`,
        );
        await this.markFailedAndReschedule(config.id, config.intervalHours, err);
      }
    }
  }

  /** Gửi thử ngay (bỏ qua nextRunAt) — trả về snapshot để debug. */
  async sendNow(id: string) {
    return this.sendReport(id);
  }

  // ── Core: gửi 1 báo cáo ──

  async sendReport(id: string) {
    const config = await this.prisma.emailReportConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException(`Email report config ${id} not found`);

    // Window cố định: từ 00:00 hôm nay đến hiện tại.
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setHours(0, 0, 0, 0);

    const report = await this.collectReportData(config.sections, dateFrom, dateTo);

    const html = buildReportHtml({
      reportName: config.name,
      dateFrom,
      dateTo,
      data: report,
    });
    const subject = buildReportSubject(config.name, dateFrom, dateTo);

    await this.mailService.sendMail({ to: config.recipients, subject, html });

    const now = new Date();
    await this.prisma.emailReportConfig.update({
      where: { id },
      data: {
        lastSentAt: now,
        nextRunAt: this.computeNextRun(now, config.intervalHours, now),
      },
    });
    await this.prisma.emailLog.create({
      data: {
        reportConfigId: id,
        recipients: config.recipients,
        subject,
        status: 'SENT',
        sentAt: now,
        payloadSummary: this.buildSummary(report),
      },
    });

    return { sent: true, recipients: config.recipients, summary: this.buildSummary(report) };
  }

  // ── Thu thập dữ liệu theo sections đã chọn ──

  private async collectReportData(
    sections: string[],
    dateFrom: Date,
    dateTo: Date,
  ): Promise<ReportData> {
    const data: ReportData = {};
    const ymd = (d: Date) => d.toISOString().slice(0, 10);

    // Các mục bán hàng dùng chung 1 lần gọi getReport.
    const needOrderReport = sections.some((s) =>
      ['sales', 'top_products', 'order_status', 'payment_methods'].includes(s),
    );
    if (needOrderReport) {
      const r = await this.ordersService.getReport({
        dateFrom: ymd(dateFrom),
        dateTo: ymd(dateTo),
      });
      if (sections.includes('sales')) {
        data.sales = {
          totalOrders: r.totalOrders,
          revenue: r.revenue,
          pendingValue: r.pendingValue,
          averageOrderValue: r.averageOrderValue,
        };
      }
      if (sections.includes('top_products')) {
        data.topProducts = r.topProducts.map((p) => {
          const product = p.product as { name?: string; unit?: string } | undefined;
          return {
            product: { name: product?.name ?? '—', unit: product?.unit },
            quantity: p.quantity,
          };
        });
      }
      if (sections.includes('order_status')) {
        data.orderStatus = r.byStatus as never;
      }
      if (sections.includes('payment_methods')) {
        data.paymentMethods = r.byPayment as never;
      }
    }

    if (sections.includes('low_stock')) {
      const stats = await this.statsService.getDashboardStats();
      data.lowStock = stats.lowStockProducts.map((p) => ({
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        category: p.category,
      }));
    }

    if (sections.includes('expiration')) {
      const exp = await this.statsService.getExpirationReport(30);
      data.expiration = {
        expiredCount: exp.expiredCount,
        expiringSoonCount: exp.expiringSoonCount,
        expiredQuantity: exp.expiredQuantity,
        expiringSoonQuantity: exp.expiringSoonQuantity,
        batches: exp.batches as never,
      };
    }

    return data;
  }

  private buildSummary(report: ReportData) {
    return {
      revenue: report.sales?.revenue ?? 0,
      totalOrders: report.sales?.totalOrders ?? 0,
      averageOrderValue: report.sales?.averageOrderValue ?? 0,
      lowStockCount: report.lowStock?.length ?? 0,
      expiredCount: report.expiration?.expiredCount ?? 0,
      expiringSoonCount: report.expiration?.expiringSoonCount ?? 0,
    };
  }

  /** Tính lần gửi kế tiếp: ưu tiên từ lastSentAt, ngược lại từ now. */
  private computeNextRun(
    lastSentAt: Date | null,
    intervalHours: number,
    now: Date,
  ): Date {
    const base = lastSentAt ?? now;
    return new Date(base.getTime() + intervalHours * 3600 * 1000);
  }

  /** Khi gửi lỗi: vẫn ghi log FAILED + dời nextRunAt để không retry liên tục trong cùng tick. */
  private async markFailedAndReschedule(
    id: string,
    intervalHours: number,
    err: unknown,
  ) {
    const now = new Date();
    const config = await this.prisma.emailReportConfig.findUnique({ where: { id } });
    await this.prisma.emailReportConfig.update({
      where: { id },
      data: { nextRunAt: new Date(now.getTime() + intervalHours * 3600 * 1000) },
    });
    await this.prisma.emailLog.create({
      data: {
        reportConfigId: id,
        recipients: config?.recipients ?? [],
        subject: config?.name ?? 'Email report',
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
