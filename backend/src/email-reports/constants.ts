// Danh sách mục nội dung báo cáo (mapping tới service số liệu đã có sẵn).
// Giá trị lưu vào EmailReportConfig.sections[].

export const SECTION_SALES = 'sales' as const;
export const SECTION_TOP_PRODUCTS = 'top_products' as const;
export const SECTION_ORDER_STATUS = 'order_status' as const;
export const SECTION_PAYMENT_METHODS = 'payment_methods' as const;
export const SECTION_LOW_STOCK = 'low_stock' as const;
export const SECTION_EXPIRATION = 'expiration' as const;

export const SECTION_WHITELIST = [
  SECTION_SALES,
  SECTION_TOP_PRODUCTS,
  SECTION_ORDER_STATUS,
  SECTION_PAYMENT_METHODS,
  SECTION_LOW_STOCK,
  SECTION_EXPIRATION,
] as const;

export type EmailReportSection = (typeof SECTION_WHITELIST)[number];

/** Nhãn tiếng Việt + mô tả ngắn cho từng mục — dùng ở cả backend (subject) và admin UI. */
export const SECTION_LABELS: Record<EmailReportSection, { label: string; description: string }> = {
  sales: {
    label: 'Tổng quan bán hàng',
    description: 'Doanh thu, số đơn hàng, giá trị trung bình/đơn, giá trị đang chờ xử lý',
  },
  top_products: {
    label: 'Sản phẩm bán chạy',
    description: 'Top sản phẩm theo số lượng bán',
  },
  order_status: {
    label: 'Đơn hàng theo trạng thái',
    description: 'Phân bố đơn hàng theo từng trạng thái',
  },
  payment_methods: {
    label: 'Phương thức thanh toán',
    description: 'Phân bố đơn hàng theo phương thức thanh toán',
  },
  low_stock: {
    label: 'Cảnh báo tồn kho thấp',
    description: 'Sản phẩm sắp hết hàng (stock ≤ mức tối thiểu)',
  },
  expiration: {
    label: 'Cảnh báo hạn sử dụng',
    description: 'Lô hàng đã hết hạn hoặc sắp hết hạn (30 ngày)',
  },
};

/** Các mốc chu kỳ gửi gợi ý (giờ) — admin có thể nhập số khác. */
export const INTERVAL_PRESETS = [1, 3, 5, 12, 24] as const;
