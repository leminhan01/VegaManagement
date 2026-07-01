import { formatVND, formatNumberVN, formatDateTimeVN } from '../common/utils/format.util';

// Nhãn tiếng Việt cho enum.
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang chuẩn bị',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REFUNDING: 'Đang hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: 'COD (nhận hàng)',
  BANK_TRANSFER: 'Chuyển khoản',
  MOMO: 'Ví MoMo',
  VNPAY: 'VNPay',
};

export interface ReportSalesData {
  totalOrders: number;
  revenue: number;
  pendingValue: number;
  averageOrderValue: number;
}

export interface ReportTopProduct {
  product: { name: string; unit?: string };
  quantity: number;
}

export interface ReportStatusRow {
  status: string;
  _count: { _all: number };
  _sum: { finalAmount: number | null };
}

export interface ReportPaymentRow {
  paymentMethod: string;
  _count: { _all: number };
  _sum: { finalAmount: number | null };
}

export interface ReportLowStockRow {
  name: string;
  stock: number;
  minStock: number;
  category?: string | null;
}

export interface ReportExpirationData {
  expiredCount: number;
  expiringSoonCount: number;
  expiredQuantity: number;
  expiringSoonQuantity: number;
  batches: Array<{ product?: { name?: string }; expirationDate?: Date | string; daysUntilExpiration: number | null }>;
}

export interface ReportData {
  sales?: ReportSalesData;
  topProducts?: ReportTopProduct[];
  orderStatus?: ReportStatusRow[];
  paymentMethods?: ReportPaymentRow[];
  lowStock?: ReportLowStockRow[];
  expiration?: ReportExpirationData;
}

export interface BuildReportHtmlInput {
  reportName: string;
  dateFrom: Date;
  dateTo: Date;
  data: ReportData;
}

// ── Helpers render ──

function section(title: string, bodyHtml: string): string {
  return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <h2 style="margin:0 0 10px 0;font-size:16px;color:#064e3b;">${title}</h2>
        ${bodyHtml}
      </td>
    </tr>`;
}

function kpiCard(label: string, value: string, sub?: string): string {
  return `
    <td style="width:50%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;">
      <div style="font-size:12px;color:#15803d;">${label}</div>
      <div style="font-size:18px;font-weight:700;color:#064e3b;margin-top:4px;">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${sub}</div>` : ''}
    </td>`;
}

function table(headers: string[], rows: string[][]): string {
  const head = headers
    .map(
      (h) =>
        `<th style="text-align:left;padding:8px 10px;background:#ecfdf5;border-bottom:2px solid #a7f3d0;font-size:12px;color:#065f46;">${h}</th>`,
    )
    .join('');
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map(
            (c, i) =>
              `<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;${i === 0 ? 'font-weight:500;' : ''}">${c}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${head}${body}</table>`;
}

// ── Builder chính ──

export function buildReportHtml({ reportName, dateFrom, dateTo, data }: BuildReportHtmlInput): string {
  const generatedAt = formatDateTimeVN(new Date());
  const window = `${formatDateTimeVN(dateFrom)} → ${formatDateTimeVN(dateTo)}`;

  const sections: string[] = [];

  // Tổng quan bán hàng
  if (data.sales) {
    const s = data.sales;
    const body = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px;">
        <tr>
          ${kpiCard('Doanh thu', formatVND(s.revenue), 'Đơn đã giao')}
          ${kpiCard('Số đơn hàng', formatNumberVN(s.totalOrders))}
        </tr>
        <tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td><td></td></tr>
        <tr>
          ${kpiCard('Giá trị TB/đơn', formatVND(s.averageOrderValue))}
          ${kpiCard('Đang chờ xử lý', formatVND(s.pendingValue), 'Chưa giao')}
        </tr>
      </table>`;
    sections.push(section('Tổng quan bán hàng', body));
  }

  // Sản phẩm bán chạy
  if (data.topProducts?.length) {
    const rows = data.topProducts.map((p) => [
      p.product.name,
      `${formatNumberVN(p.quantity)} ${p.product.unit ?? ''}`.trim(),
    ]);
    sections.push(section('Sản phẩm bán chạy', table(['Sản phẩm', 'Số lượng'], rows)));
  }

  // Đơn hàng theo trạng thái
  if (data.orderStatus?.length) {
    const rows = data.orderStatus.map((r) => [
      ORDER_STATUS_LABELS[r.status] ?? r.status,
      formatNumberVN(r._count._all),
      formatVND(r._sum.finalAmount ?? 0),
    ]);
    sections.push(section('Đơn hàng theo trạng thái', table(['Trạng thái', 'Số đơn', 'Giá trị'], rows)));
  }

  // Phương thức thanh toán
  if (data.paymentMethods?.length) {
    const rows = data.paymentMethods.map((r) => [
      PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod,
      formatNumberVN(r._count._all),
      formatVND(r._sum.finalAmount ?? 0),
    ]);
    sections.push(
      section('Phương thức thanh toán', table(['Phương thức', 'Số đơn', 'Giá trị'], rows)),
    );
  }

  // Cảnh báo tồn kho thấp
  if (data.lowStock?.length) {
    const rows = data.lowStock.map((p) => [
      p.name,
      p.category ?? '—',
      `${formatNumberVN(p.stock)} / ${formatNumberVN(p.minStock)}`,
    ]);
    sections.push(section('Cảnh báo tồn kho thấp', table(['Sản phẩm', 'Danh mục', 'Tồn / Tối thiểu'], rows)));
  }

  // Cảnh báo hạn sử dụng
  if (data.expiration) {
    const e = data.expiration;
    const body = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px;">
        <tr>
          ${kpiCard('Lô đã hết hạn', `${formatNumberVN(e.expiredCount)}`, `${formatNumberVN(e.expiredQuantity)} sản phẩm`)}
          ${kpiCard('Lô sắp hết hạn', `${formatNumberVN(e.expiringSoonCount)}`, `${formatNumberVN(e.expiringSoonQuantity)} sản phẩm`)}
        </tr>
      </table>`;
    sections.push(section('Cảnh báo hạn sử dụng (30 ngày)', body));
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>${reportName}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#064e3b;padding:20px 24px;">
            <div style="font-size:18px;font-weight:700;color:#ffffff;">${reportName}</div>
            <div style="font-size:12px;color:#a7f3d0;margin-top:4px;">Vegan Shop System</div>
          </td>
        </tr>
        <tr><td style="padding:20px 24px 8px 24px;">
          <div style="font-size:13px;color:#374151;">Khoảng thời gian: <strong>${window}</strong></div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Tạo lúc ${generatedAt}</div>
        </td></tr>
        <tr><td style="padding:8px 24px 24px 24px;">
          ${sections.length ? `<table width="100%" cellpadding="0" cellspacing="0">${sections.join('')}</table>` : '<p style="color:#6b7280;font-size:13px;">Chưa có mục nội dung nào được chọn cho báo cáo này.</p>'}
        </td></tr>
        <tr><td style="padding:12px 24px;border-top:1px solid #e5e7eb;">
          <div style="font-size:11px;color:#9ca3af;">Email này được gửi tự động bởi hệ thống Vegan Shop. Vui lòng không trả lời.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Subject email theo khoảng thời gian. */
export function buildReportSubject(reportName: string, dateFrom: Date, dateTo: Date): string {
  return `${reportName} — ${formatDateTimeVN(dateFrom)} → ${formatDateTimeVN(dateTo)}`;
}
