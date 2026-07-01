// Tiện ích format dùng khi render nội dung email server-side.
// (Riêng với admin/src/lib/format.ts là client-only.)

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

/** Format số tiền VND → "1.500.000 ₫" */
export function formatVND(amount: number): string {
  return vndFormatter.format(amount ?? 0);
}

/** Format số nguyên có dấu phân cách hàng nghìn → "1.234" */
export function formatNumberVN(value: number): string {
  return numberFormatter.format(value ?? 0);
}

/** Format ngày/giờ kiểu Việt Nam → "01/07/2026 14:30" */
export function formatDateTimeVN(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/** Format ngày kiểu Việt Nam → "01/07/2026" */
export function formatDateVN(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(d);
}
