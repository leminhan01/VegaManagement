// ── Format & helper utilities dùng chung ──
// Gom các helper từng bị lặp trong từng page (dashboard/products/orders/...).

/** Định dạng tiền VND dạng rút gọn cho KPI / tiêu đề biểu đồ. */
export function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷđ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}trđ`;
  return value.toLocaleString("vi-VN") + "đ";
}

/** Định dạng tiền VND đầy đủ (dùng trong bảng, tooltip). */
export function formatCurrencyFull(value: number): string {
  return value.toLocaleString("vi-VN") + "đ";
}

/** Định dạng số nguyên có dấu phẩy ngăn cách. */
export function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN");
}

/** dd/mm/yyyy */
export function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** HH:mm dd/mm/yyyy */
export function formatDateTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Số thập phân có dấu %. VD: 12.3 -> "+12.3%", -4 -> "-4.0%". */
export function formatTrend(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

/** Phần trăm thuần (không dấu). VD: 0.45 -> "45%". */
export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Chữ cái đầu của tên (tối đa 2 ký tự). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Tỉ lệ thay đổi % (current vs previous).
 * Khớp logic backend stats.service.ts: previous=0 thì +100 nếu current>0, 0 nếu =0.
 */
export function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

/** Date -> "YYYY-MM-DD" (giá trị cho <input type="date">). */
export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DateRange {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
}

/**
 * Tính khoảng thời gian liền trước có cùng độ dài.
 * VD: 01–07/01 -> 25–31/12. Dùng cho so sánh kỳ trước (trend).
 */
export function shiftRange(range: DateRange): DateRange {
  const from = new Date(range.dateFrom + "T00:00:00");
  const to = new Date(range.dateTo + "T00:00:00");
  const lengthMs = to.getTime() - from.getTime();
  const dayMs = 86_400_000;
  const prevTo = new Date(from.getTime() - dayMs);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { dateFrom: toYMD(prevFrom), dateTo: toYMD(prevTo) };
}

/** Số ngày giữa dateFrom và dateTo (inclusive). */
export function rangeDays(range: DateRange): number {
  const from = new Date(range.dateFrom + "T00:00:00");
  const to = new Date(range.dateTo + "T00:00:00");
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
}

/**
 * Đảm bảo mảng daily liên tục từng ngày trong [from, to] — điền 0 cho ngày
 * không có đơn. Giúp biểu đồ doanh thu hiển thị timeline liền mạch.
 */
export function fillDailyGaps(
  dateFrom: string,
  dateTo: string,
  daily: DailyPoint[],
): DailyPoint[] {
  const map = new Map(daily.map((d) => [d.day, d]));
  const out: DailyPoint[] = [];
  const cur = new Date(dateFrom + "T00:00:00");
  const end = new Date(dateTo + "T00:00:00");
  while (cur <= end) {
    const key = toYMD(cur);
    const point = map.get(key);
    out.push({
      day: key,
      orders: point?.orders ?? 0,
      revenue: point?.revenue ?? 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * Xuất danh sách object ra file CSV (UTF-8 BOM để Excel đọc đúng tiếng Việt).
 * Trả về true nếu thành công.
 */
export function exportToCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
): boolean {
  if (typeof document === "undefined") return false;

  const escape = (val: string | number): string => {
    const s = String(val ?? "");
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const headerLine = columns.map((c) => escape(c.header)).join(";");
  const dataLines = rows.map((row) =>
    columns.map((c) => escape(c.accessor(row))).join(";"),
  );
  const csv = [headerLine, ...dataLines].join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
