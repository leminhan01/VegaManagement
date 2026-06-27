"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type {
  Customer,
  CustomerStats,
  Order,
  PaginatedResponse,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

const GROUP_OPTIONS = [
  { value: "LEAD", label: "Tiềm năng" },
  { value: "REGULAR", label: "Thường" },
  { value: "LOYAL", label: "Thân thiết" },
  { value: "VIP", label: "VIP" },
  { value: "WHOLESALE", label: "Bán sỉ" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase();
}

function getGroupLabel(group?: string) {
  return GROUP_OPTIONS.find((item) => item.value === group)?.label ?? group ?? "Thường";
}

function groupClass(group?: string) {
  if (group === "VIP") return "bg-primary text-on-primary";
  if (group === "LOYAL") return "bg-secondary-container text-on-secondary-container";
  if (group === "WHOLESALE") return "bg-tertiary-fixed text-on-tertiary-fixed";
  if (group === "LEAD") return "bg-surface-container-high text-on-surface-variant";
  return "bg-primary/10 text-primary";
}

function CustomerDetailContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(Boolean(customerId));
  const [error, setError] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError("");
    try {
      const [detail, orderPage, statsData] = await Promise.all([
        apiClient.getCustomer(customerId),
        apiClient.getCustomerOrders(customerId, "page=1&limit=50"),
        apiClient.getCustomerStats(customerId),
      ]);
      if (detail) setCustomer(detail as Customer);
      const pagedOrders = orderPage as PaginatedResponse<Order> | null;
      if (pagedOrders) setOrders(pagedOrders.data);
      if (statsData) setStats(statsData as CustomerStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết khách hàng");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (!customerId) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Quay lại danh sách
        </Link>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-10 text-center">
          <h2 className="text-xl font-bold text-on-surface">Chưa chọn khách hàng</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Vui lòng chọn một khách hàng từ danh sách để xem chi tiết.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center p-6">
        <div className="text-center text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
            progress_activity
          </span>
          <p className="mt-3 text-sm">Đang tải chi tiết khách hàng...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Link href="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Quay lại danh sách
        </Link>
        <div className="rounded-lg border border-error/30 bg-error-container p-6 text-on-error-container">
          {error || "Không tìm thấy khách hàng."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <Link
            href="/customers"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Quay lại danh sách
          </Link>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-lg font-bold text-primary">
              {getInitials(customer.name)}
            </span>
            <div>
              <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
                {customer.name}
              </h2>
              <p className="text-on-surface-variant">{customer.phone}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${groupClass(customer.group)}`}>
            {getGroupLabel(customer.group)}
          </span>
          {customer.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon="receipt_long" iconBgColor="bg-primary-fixed" label="Tổng đơn" value={formatNumber(stats?.totalOrders ?? customer.totalOrders ?? 0)} />
        <StatCard icon="payments" iconBgColor="bg-secondary-container" label="Tổng chi tiêu" value={formatCurrency(stats?.totalSpent ?? customer.totalSpent ?? 0)} />
        <StatCard icon="monitoring" iconBgColor="bg-surface-container-high" label="Giá trị TB" value={formatCurrency(stats?.averageOrderValue ?? customer.averageOrderValue ?? 0)} />
        <StatCard icon="tips_and_updates" iconBgColor="bg-tertiary-fixed" label="Gợi ý nhóm" value={getGroupLabel(stats?.suggestedGroup ?? customer.suggestedGroup)} />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <h3 className="font-bold text-on-surface">Thông tin liên hệ</h3>
          <div className="mt-4 space-y-2 text-sm">
            <p><span className="text-on-surface-variant">Email:</span> {customer.email ?? "-"}</p>
            <p><span className="text-on-surface-variant">Địa chỉ:</span> {customer.address ?? "-"}</p>
            <p><span className="text-on-surface-variant">Ngày tạo:</span> {formatDate(customer.createdAt)}</p>
            <p><span className="text-on-surface-variant">Đơn gần nhất:</span> {formatDate(customer.lastOrderAt)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <h3 className="font-bold text-on-surface">Ghi chú khách hàng</h3>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
            {customer.note || "Chưa có ghi chú cho khách hàng này."}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-5 py-4 font-bold">
          Địa chỉ giao hàng
        </div>
        <div className="divide-y divide-outline-variant">
          {(customer.shippingAddresses ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-on-surface-variant">Chưa có địa chỉ giao hàng.</p>
          ) : (
            customer.shippingAddresses?.map((address, index) => (
              <div key={`${address.address}-${index}`} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{address.label || `Địa chỉ ${index + 1}`}</p>
                  {address.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      Mặc định
                    </span>
                  )}
                </div>
                <p className="mt-1 text-on-surface-variant">{address.address}</p>
                <p className="text-on-surface-variant">
                  {address.receiverName ?? customer.name} · {address.phone ?? customer.phone}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-5 py-4 font-bold">
          Lịch sử đơn hàng
        </div>
        <div className="divide-y divide-outline-variant">
          {orders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-on-surface-variant">Khách hàng chưa có đơn hàng.</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-primary">{order.orderCode}</p>
                  <p className="text-xs text-on-surface-variant">{formatDate(order.createdAt)} · {order.items.length} dòng hàng</p>
                </div>
                <StatusBadge status={order.status} />
                <p className="text-right font-semibold text-primary">{formatCurrency(order.finalAmount)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-5 py-4 font-bold">
          Sản phẩm mua nhiều
        </div>
        <div className="divide-y divide-outline-variant">
          {(stats?.topProducts ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-on-surface-variant">Chưa có dữ liệu sản phẩm đã mua.</p>
          ) : (
            stats?.topProducts.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between px-5 py-4 text-sm">
                <div>
                  <p className="font-semibold">{item.product.name}</p>
                  <p className="text-xs text-on-surface-variant">{item.product.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{formatNumber(item.quantity)}</p>
                  <p className="text-xs text-on-surface-variant">{formatCurrency(item.amount)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={null}>
      <CustomerDetailContent />
    </Suspense>
  );
}
