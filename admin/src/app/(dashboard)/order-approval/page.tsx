"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Order,
  OrderStatus,
  PaginatedResponse,
  PaymentMethod,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

const PAYMENT_METHODS: Array<{ value: PaymentMethod | ""; label: string }> = [
  { value: "", label: "Tất cả thanh toán" },
  { value: "COD", label: "COD" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "MOMO", label: "MoMo" },
  { value: "VNPAY", label: "VNPay" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPaymentLabel(value: PaymentMethod) {
  return (
    PAYMENT_METHODS.find((item) => item.value === value)?.label ?? value
  );
}

function itemsSummary(order: Order) {
  const names = order.items.map(
    (item) => `${item.product.name} ×${item.quantity}`,
  );
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} (+${names.length - 2} nữa)`;
}

export default function OrderApprovalPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      status: "PENDING",
      sort: "createdAt",
      order: "asc",
      page: "1",
      limit: "100",
    });
    if (search.trim()) params.set("search", search.trim());
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    return params;
  }, [search, paymentMethod]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = (await apiClient.getOrders(
        buildParams().toString(),
      )) as PaginatedResponse<Order> | null;
      if (res) {
        setOrders(res.data);
        // Bỏ chọn các đơn không còn trong danh sách.
        setSelectedIds((prev) => {
          const ids = new Set(res.data.map((o) => o.id));
          return new Set([...prev].filter((id) => ids.has(id)));
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được đơn hàng");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [fetchOrders]);

  const stats = useMemo(() => {
    const totalValue = orders.reduce(
      (sum, order) => sum + order.finalAmount,
      0,
    );
    const codCount = orders.filter((o) => o.paymentMethod === "COD").length;
    return { count: orders.length, totalValue, codCount };
  }, [orders]);

  const allSelected =
    orders.length > 0 && orders.every((o) => selectedIds.has(o.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o) => o.id)));
  };

  const approve = async (id: string) => {
    setActionLoading(true);
    setError("");
    try {
      await apiClient.updateOrderStatus(id, "CONFIRMED" as OrderStatus);
      await fetchOrders();
      setDetailOrder((cur) => (cur?.id === id ? null : cur));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không duyệt được đơn");
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (id: string) => {
    if (!window.confirm("Từ chối đơn này? Tồn kho sẽ được hoàn lại.")) return;
    setActionLoading(true);
    setError("");
    try {
      await apiClient.cancelOrder(id);
      await fetchOrders();
      setDetailOrder((cur) => (cur?.id === id ? null : cur));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không từ chối được đơn");
    } finally {
      setActionLoading(false);
    }
  };

  const approveBulk = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    setError("");
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          apiClient.updateOrderStatus(id, "CONFIRMED" as OrderStatus),
        ),
      );
      setSelectedIds(new Set());
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi khi duyệt hàng loạt");
      await fetchOrders();
    } finally {
      setActionLoading(false);
    }
  };

  const rejectBulk = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Từ chối ${selectedIds.size} đơn đã chọn? Tồn kho sẽ được hoàn lại.`,
      )
    )
      return;
    setActionLoading(true);
    setError("");
    try {
      await Promise.all(
        [...selectedIds].map((id) => apiClient.cancelOrder(id)),
      );
      setSelectedIds(new Set());
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi khi từ chối hàng loạt");
      await fetchOrders();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-hanken)] text-2xl font-bold text-on-surface">
            Duyệt đơn hàng
          </h1>
          <p className="text-sm text-on-surface-variant">
            Các đơn mới đặt từ storefront đang chờ xác nhận.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Làm mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon="pending_actions"
          iconBgColor="bg-secondary-container"
          label="Đơn chờ duyệt"
          value={String(stats.count)}
        />
        <StatCard
          icon="payments"
          iconBgColor="bg-primary-fixed"
          label="Tổng giá trị chờ"
          value={formatCurrency(stats.totalValue)}
        />
        <StatCard
          icon="local_mall"
          iconBgColor="bg-surface-container-high"
          label="Đơn COD chờ"
          value={String(stats.codCount)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4">
        <div className="relative min-w-[220px] flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn, SĐT, tên khách..."
            className="w-full rounded-lg border border-outline-variant bg-surface py-2 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={paymentMethod}
          onChange={(e) =>
            setPaymentMethod(e.target.value as PaymentMethod | "")
          }
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {PAYMENT_METHODS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">
            Đã chọn {selectedIds.size}
          </span>
          <button
            type="button"
            disabled={selectedIds.size === 0 || actionLoading}
            onClick={approveBulk}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            Duyệt hàng loạt
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || actionLoading}
            onClick={rejectBulk}
            className="inline-flex items-center gap-1.5 rounded-lg border border-error/40 bg-error-container/30 px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-container/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            Từ chối hàng loạt
          </button>
        </div>
      </div>

      {/* List */}
      {loading && orders.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center text-on-surface-variant">
          Đang tải đơn hàng...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
            inbox
          </span>
          <p className="mt-2 text-sm text-on-surface-variant">
            Không có đơn hàng nào chờ duyệt. 🎉
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 accent-primary"
            />
            {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </label>

          {orders.map((order) => {
            const checked = selectedIds.has(order.id);
            return (
              <div
                key={order.id}
                className={`rounded-xl border bg-surface-container-lowest p-4 transition-all hover:shadow-sm ${
                  checked
                    ? "border-primary/60 ring-1 ring-primary/30"
                    : "border-outline-variant/60 hover:border-outline"
                }`}
              >
                {/* Hàng thông tin */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(order.id)}
                    className="mt-1 h-4 w-4 accent-primary"
                    aria-label={`Chọn đơn ${order.orderCode}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-primary">
                        {order.orderCode}
                      </span>
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-on-surface">
                      {order.customer.name}
                      <span className="ml-2 font-normal text-on-surface-variant">
                        {order.customer.phone}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                      {itemsSummary(order)}
                    </p>
                    {order.note && (
                      <p className="mt-1 flex items-start gap-1 text-xs italic text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">
                          sticky_note_2
                        </span>
                        <span className="line-clamp-1">{order.note}</span>
                      </p>
                    )}
                  </div>

                  <div className="ml-auto shrink-0 text-right">
                    <p className="text-xs text-on-surface-variant">
                      {getPaymentLabel(order.paymentMethod)}
                    </p>
                    <p className="font-[family-name:var(--font-hanken)] text-lg font-bold text-on-surface">
                      {formatCurrency(order.finalAmount)}
                    </p>
                  </div>
                </div>

                {/* Hàng thao tác */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant/50 pt-3 justify-end">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => approve(order.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      check
                    </span>
                    Duyệt
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => reject(order.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-error/40 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error-container/30 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      close
                    </span>
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailOrder(order)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      visibility
                    </span>
                    Chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail slide-over */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDetailOrder(null)}
          />
          <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface-container-lowest shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
              <div>
                <h2 className="font-[family-name:var(--font-jetbrains)] text-base font-semibold text-primary">
                  {detailOrder.orderCode}
                </h2>
                <StatusBadge status={detailOrder.status} />
              </div>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-highest"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 px-5 py-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-on-surface-variant">
                  Khách hàng
                </p>
                <p className="font-medium text-on-surface">
                  {detailOrder.customer.name}
                </p>
                <p className="text-on-surface-variant">
                  {detailOrder.customer.phone}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-on-surface-variant">
                  Địa chỉ giao hàng
                </p>
                <p className="text-on-surface">{detailOrder.shippingAddress}</p>
                <p className="text-on-surface-variant">
                  SĐT: {detailOrder.shippingPhone}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-on-surface-variant">
                  Thanh toán
                </p>
                <p className="text-on-surface">
                  {getPaymentLabel(detailOrder.paymentMethod)}
                </p>
              </div>
              {detailOrder.note && (
                <div>
                  <p className="text-xs font-semibold uppercase text-on-surface-variant">
                    Ghi chú
                  </p>
                  <p className="text-on-surface">{detailOrder.note}</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">
                  Sản phẩm ({detailOrder.items.length})
                </p>
                <div className="space-y-2">
                  {detailOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-outline-variant/60 bg-surface px-3 py-2"
                    >
                      <div className="pr-2">
                        <p className="font-medium text-on-surface">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {formatCurrency(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium text-on-surface">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t border-outline-variant pt-3">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Tạm tính</span>
                  <span>{formatCurrency(detailOrder.totalAmount)}</span>
                </div>
                {detailOrder.discount > 0 && (
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Giảm giá</span>
                    <span>-{formatCurrency(detailOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold text-on-surface">
                  <span>Thành tiền</span>
                  <span>{formatCurrency(detailOrder.finalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto flex gap-2 border-t border-outline-variant px-5 py-4">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => approve(detailOrder.id)}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Duyệt đơn
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => reject(detailOrder.id)}
                className="flex-1 rounded-lg border border-error/40 px-3 py-2 text-sm font-medium text-error hover:bg-error-container/30 disabled:opacity-50"
              >
                Từ chối
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
