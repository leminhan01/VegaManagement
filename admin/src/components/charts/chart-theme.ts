// ── Recharts theme (Material Design 3 Green) ──
// Tailwind v4 không áp dụng class vào SVG Recharts, nên truyền màu tĩnh lấy
// giá trị đúng từ globals.css.

export const CHART_COLORS = {
  primary: "#006948",
  primaryContainer: "#00855d",
  primaryDim: "#68dba9",
  primaryFixed: "#85f8c4",
  secondary: "#2b6954",
  secondaryDim: "#95d3ba",
  tertiary: "#535f58",
  error: "#ba1a1a",
  outline: "#6d7a72",
  outlineVariant: "#bccac0",
  onSurfaceVariant: "#3d4a42",
  surface: "#f8f9ff",
} as const;

/** Bảng màu chuỗi (pie / nhiều bar) — ưu tiên sắc xanh brand rồi đến phụ. */
export const SERIES_PALETTE = [
  "#006948",
  "#2b6954",
  "#00855d",
  "#535f58",
  "#68dba9",
  "#95d3ba",
  "#adedd3",
  "#85f8c4",
] as const;

/** Style trục cho Recharts (font Inter). */
export const axisTickStyle = {
  fontFamily: "var(--font-body-lg)",
  fontSize: 12,
  fill: "#3d4a42",
} as const;

/** Màu cố định cho từng trạng thái đơn hàng. */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "#6d7a72",
  CONFIRMED: "#00855d",
  PROCESSING: "#2b6954",
  SHIPPED: "#006948",
  DELIVERED: "#005137",
  CANCELLED: "#ba1a1a",
  REFUNDING: "#b45309",
  REFUNDED: "#93000a",
};

/** Màu cố định cho từng phương thức thanh toán. */
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  COD: "#006948",
  BANK_TRANSFER: "#2b6954",
  MOMO: "#b45309",
  VNPAY: "#00855d",
};

/** Nhãn tiếng Việt cho trạng thái đơn. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang chuẩn bị",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  REFUNDING: "Đang hoàn",
  REFUNDED: "Đã hoàn tiền",
};

/** Nhãn tiếng Việt cho phương thức thanh toán. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: "COD",
  BANK_TRANSFER: "Chuyển khoản",
  MOMO: "MoMo",
  VNPAY: "VNPay",
};
