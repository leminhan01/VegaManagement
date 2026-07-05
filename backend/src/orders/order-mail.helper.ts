/**
 * Helper build nội dung email xác nhận đơn hàng, dùng khi nhân viên "lên đơn"
 * (chuyển order từ PENDING → CONFIRMED). Order truyền vào phải include
 * customer + items.product (theo ORDER_INCLUDE trong orders.service.ts).
 */

type OrderForMail = {
  orderCode: string;
  finalAmount: number;
  totalAmount: number;
  discount: number;
  shippingAddress: string;
  shippingPhone: string;
  note?: string | null;
  customer: { name: string; phone: string; email?: string | null } | null;
  items: Array<{
    quantity: number;
    unitPrice: number;
    product: { name: string };
  }>;
};

const formatVnd = (value: number): string =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value));

export function buildOrderConfirmationHtml(order: OrderForMail): string {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.product.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatVnd(item.unitPrice)}đ</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatVnd(item.unitPrice * item.quantity)}đ</td>
      </tr>`,
    )
    .join('');

  const discountRow =
    order.discount > 0
      ? `<tr><td colspan="3" style="padding:8px;text-align:right;">Giảm giá</td><td style="padding:8px;text-align:right;">-${formatVnd(order.discount)}đ</td></tr>`
      : '';

  const noteRow = order.note
    ? `<p style="margin-top:12px;color:#555;"><b>Ghi chú:</b> ${escapeHtml(order.note)}</p>`
    : '';

  const customerName = order.customer?.name ?? 'Quý khách';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;">
    <h2 style="color:#2e7d32;">Cảm ơn ${escapeHtml(customerName)}, đơn hàng đã được xác nhận! 🌿</h2>
    <p>Chào ${escapeHtml(customerName)}, shop đã tiếp nhận và xác nhận đơn hàng của bạn. Đơn hàng sẽ được chuẩn bị và giao đến bạn trong thời gian sớm nhất.</p>

    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;text-align:left;">Sản phẩm</th>
          <th style="padding:8px;text-align:center;">SL</th>
          <th style="padding:8px;text-align:right;">Đơn giá</th>
          <th style="padding:8px;text-align:right;">Tạm tính</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        ${discountRow}
        <tr>
          <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Tổng thanh toán (COD)</td>
          <td style="padding:8px;text-align:right;font-weight:bold;color:#2e7d32;">${formatVnd(order.finalAmount)}đ</td>
        </tr>
      </tfoot>
    </table>

    ${noteRow}

    <div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:6px;">
      <p style="margin:4px 0;"><b>Mã đơn:</b> ${escapeHtml(order.orderCode)}</p>
      <p style="margin:4px 0;"><b>Địa chỉ giao:</b> ${escapeHtml(order.shippingAddress)}</p>
      <p style="margin:4px 0;"><b>SĐT nhận hàng:</b> ${escapeHtml(order.shippingPhone)}</p>
    </div>

    <p style="margin-top:16px;color:#888;font-size:12px;">Đây là email tự động, vui lòng không trả lời. Nếu cần hỗ trợ vui lòng liên hệ hotline của cửa hàng.</p>
  </div>`;
}

export function buildOrderConfirmationSubject(orderCode: string): string {
  return `Đơn hàng ${orderCode} đã được xác nhận 🌿`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
