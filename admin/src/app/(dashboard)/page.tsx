"use client";

import { useState, useEffect, type ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  OrderReport,
  DashboardStats,
  Order,
  PaginatedResponse,
  OrderStatus,
  InventoryValueReport,
  ExpirationReport,
  StockMovementReport,
} from "@/lib/types";
import {
  formatCurrency,
  formatCurrencyFull,
  formatDate,
  formatNumber,
  formatTrend,
  getInitials,
  computeTrend,
  toYMD,
  shiftRange,
  rangeDays,
  fillDailyGaps,
  exportToCsv,
  type DateRange,
} from "@/lib/format";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { OrderStatusDonut } from "@/components/charts/order-status-donut";
import { TopProductsBarChart } from "@/components/charts/top-products-bar-chart";
import { PaymentBreakdownPie } from "@/components/charts/payment-breakdown-pie";
import { StockMovementChart } from "@/components/charts/stock-movement-chart";
import { InventoryValueByCategory } from "@/components/charts/inventory-value-by-category";

interface DashboardData {
  current: OrderReport;
  previous: OrderReport;
  inventoryValue: InventoryValueReport;
  expiration: ExpirationReport;
  stockMovement: StockMovementReport;
  lowStock: DashboardStats["lowStockProducts"];
  recentOrders: Order[];
}

function defaultRange(): DateRange {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { dateFrom: toYMD(from), dateTo: toYMD(today) };
}

function trendProps(change: number) {
  if (change >= 0)
    return {
      trendIcon: "trending_up",
      trendColor: "text-primary",
      trendBg: "bg-primary/10",
    };
  return {
    trendIcon: "trending_down",
    trendColor: "text-error",
    trendBg: "bg-error/10",
  };
}

function daysLabel(d: number): { text: string; danger: boolean } {
  if (d < 0) return { text: `Quá hạn ${Math.abs(d)} ngày`, danger: true };
  if (d === 0) return { text: "Hết hạn hôm nay", danger: true };
  return { text: `Còn ${d} ngày`, danger: d <= 7 };
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-container-high ${
        className ?? ""
      }`}
    />
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 ${
        className ?? ""
      }`}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-lg font-semibold text-on-surface">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const prev = shiftRange(range);
        const curParams = `dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`;
        const prevParams = `dateFrom=${prev.dateFrom}&dateTo=${prev.dateTo}`;
        const days = rangeDays(range);

        const results = await Promise.all([
          apiClient.getOrderReport(curParams),
          apiClient.getOrderReport(prevParams),
          apiClient.getInventoryValueReport(),
          apiClient.getExpirationReport("daysThreshold=30"),
          apiClient.getStockMovementReport(`days=${days}`),
          apiClient.getDashboardStats(),
          apiClient.getOrders("page=1&limit=5&sort=-createdAt"),
        ]);
        if (cancelled) return;

        const current = results[0] as OrderReport;
        const previous = results[1] as OrderReport;
        const inventoryValue = results[2] as InventoryValueReport;
        const expiration = results[3] as ExpirationReport;
        const stockMovement = results[4] as StockMovementReport;
        const dash = results[5] as DashboardStats;
        const recentPage = results[6] as PaginatedResponse<Order> | null;

        setData({
          current,
          previous,
          inventoryValue,
          expiration,
          stockMovement,
          lowStock: dash?.lowStockProducts ?? [],
          recentOrders: recentPage?.data ?? [],
        });
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải dữ liệu dashboard",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  function handleExport() {
    if (!data) return;
    exportToCsv(
      `dashboard-doanh-thu-${range.dateFrom}_${range.dateTo}.csv`,
      [
        { header: "Ngày", accessor: (r) => formatDate(r.day) },
        { header: "Số đơn hàng", accessor: (r) => r.orders },
        { header: "Doanh thu (VND)", accessor: (r) => Math.round(r.revenue) },
      ],
      data.current.daily,
    );
  }

  // ── Initial loading skeleton ──
  if (loading && !data) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  // ── Error state ──
  if (error && !data) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-2xl bg-error-container p-6">
          <span className="material-symbols-outlined mt-0.5 text-2xl text-error">
            error
          </span>
          <div>
            <p className="font-medium text-error">Không thể tải dữ liệu</p>
            <p className="mt-1 text-sm text-error/80">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-error px-4 py-1.5 text-sm font-medium text-on-error transition-colors hover:bg-error/90"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { current, previous, inventoryValue, expiration, stockMovement, lowStock, recentOrders } =
    data;

  const revTrend = computeTrend(current.revenue, previous.revenue);
  const ordTrend = computeTrend(current.totalOrders, previous.totalOrders);
  const aovTrend = computeTrend(
    current.averageOrderValue,
    previous.averageOrderValue,
  );

  const prevRange = shiftRange(range);
  const dailyFilled = fillDailyGaps(range.dateFrom, range.dateTo, current.daily);
  const prevDailyFilled = fillDailyGaps(
    prevRange.dateFrom,
    prevRange.dateTo,
    previous.daily,
  );

  const statusData = current.byStatus.map((s) => ({
    status: s.status,
    count: s._count._all,
    value: s._sum.finalAmount ?? 0,
  }));
  const paymentData = current.byPayment.map((p) => ({
    method: p.paymentMethod,
    count: p._count._all,
    value: p._sum.finalAmount ?? 0,
  }));
  const topProducts = current.topProducts.map((t) => ({
    name: t.product.name ?? `SP ${(t.product.id ?? "").slice(0, 6)}`,
    quantity: t.quantity,
  }));
  const expirationBatches = (expiration.batches ?? [])
    .slice()
    .sort((a, b) => (a.daysUntilExpiration ?? 0) - (b.daysUntilExpiration ?? 0))
    .slice(0, 5);

  return (
    <div className={`space-y-6 p-6 ${loading ? "opacity-70" : ""}`}>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-hanken)] text-2xl font-semibold text-on-background">
            Dashboard Tổng Quan
          </h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Thống kê bán hàng &amp; tồn kho · so sánh với kỳ trước
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            value={range}
            onChange={(r) => setRange(r)}
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* ── KPI row 1 ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="payments"
          iconBgColor="bg-secondary-container"
          iconTextColor="text-on-secondary-container"
          label="Doanh thu"
          value={formatCurrency(current.revenue)}
          trend={formatTrend(revTrend)}
          {...trendProps(revTrend)}
        />
        <StatCard
          icon="receipt_long"
          iconBgColor="bg-surface-container"
          iconTextColor="text-on-surface-variant"
          label="Đơn hàng"
          value={formatNumber(current.totalOrders)}
          trend={formatTrend(ordTrend)}
          {...trendProps(ordTrend)}
        />
        <StatCard
          icon="shopping_bag"
          iconBgColor="bg-primary-fixed"
          iconTextColor="text-on-primary-fixed"
          label="Giá trị TB / đơn (AOV)"
          value={formatCurrency(current.averageOrderValue)}
          trend={formatTrend(aovTrend)}
          {...trendProps(aovTrend)}
        />
        <StatCard
          icon="inventory_2"
          iconBgColor="bg-tertiary-container"
          iconTextColor="text-on-tertiary"
          label="Giá trị tồn kho"
          value={formatCurrency(inventoryValue.totalValue)}
          subtitle={`${formatNumber(inventoryValue.totalStock)} đơn vị`}
        />
      </div>

      {/* ── KPI row 2 ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          icon="pending_actions"
          iconBgColor="bg-surface-container"
          iconTextColor="text-on-surface-variant"
          label="Đang chờ xử lý"
          value={formatCurrency(current.pendingValue)}
          subtitle="PENDING → SHIPPED"
        />
        <StatCard
          icon="warning"
          iconBgColor="bg-error-container"
          iconTextColor="text-on-error-container"
          label="Sản phẩm sắp hết"
          value={formatNumber(lowStock.length)}
          variant="error"
          subtitle={`${lowStock.filter((p) => p.stock === 0).length} hết hàng`}
        />
        <StatCard
          icon="event_busy"
          iconBgColor="bg-error-container"
          iconTextColor="text-on-error-container"
          label="Lô sắp hết hạn"
          value={formatNumber(expiration.expiringSoonCount + expiration.expiredCount)}
          variant="error"
          subtitle={`${expiration.expiredCount} đã quá hạn`}
        />
      </div>

      {/* ── Revenue + Order status ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="Tăng trưởng doanh thu"
          subtitle="Kỳ này (diện tích) so với kỳ trước (đường chấm)"
          icon="trending_up"
          className="lg:col-span-2"
        >
          <RevenueAreaChart current={dailyFilled} previous={prevDailyFilled} />
        </ChartCard>
        <ChartCard
          title="Đơn hàng theo trạng thái"
          subtitle="Phân bố trong kỳ"
          icon="donut_large"
        >
          <OrderStatusDonut data={statusData} />
        </ChartCard>
      </div>

      {/* ── Top products + Payment ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Sản phẩm bán chạy"
          subtitle="Top theo số lượng đã bán"
          icon="trending_up"
        >
          <TopProductsBarChart data={topProducts} />
        </ChartCard>
        <ChartCard
          title="Phương thức thanh toán"
          subtitle="Tỷ trọng đơn theo kênh"
          icon="credit_card"
        >
          <PaymentBreakdownPie data={paymentData} />
        </ChartCard>
      </div>

      {/* ── Inventory movement + value by category ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="Biến động tồn kho"
          subtitle={`Nhập / xuất / điều chỉnh · ${stockMovement.days ?? rangeDays(range)} ngày qua`}
          icon="sync_alt"
          className="lg:col-span-2"
        >
          <StockMovementChart data={stockMovement.byDay} />
        </ChartCard>
        <ChartCard
          title="Giá trị theo danh mục"
          subtitle="Tỷ trọng giá trị tồn kho"
          icon="pie_chart"
        >
          <InventoryValueByCategory data={inventoryValue.byCategory} />
        </ChartCard>
      </div>

      {/* ── Alerts: low stock + expiration ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Low stock */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-hanken)] text-lg font-semibold text-on-surface">
              Sắp hết hàng
            </h2>
            <a
              href="/products"
              className="text-sm font-medium text-primary hover:underline"
            >
              Quản lý kho
            </a>
          </div>
          <div className="space-y-2">
            {lowStock.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                Không có sản phẩm sắp hết hàng
              </p>
            ) : (
              lowStock.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="material-symbols-outlined text-lg text-primary">
                      nutrition
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {product.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Tồn kho:{" "}
                      <span
                        className={`font-medium ${
                          product.stock === 0 ? "text-error" : "text-error"
                        }`}
                      >
                        {product.stock}/{product.minStock}
                      </span>
                    </p>
                  </div>
                  <a
                    href="/products"
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    Nhập
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expiration */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-hanken)] text-lg font-semibold text-on-surface">
              Hạn sử dụng sắp tới
            </h2>
            <a
              href="/expiration"
              className="text-sm font-medium text-primary hover:underline"
            >
              Xem tất cả
            </a>
          </div>
          <div className="space-y-2">
            {expirationBatches.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                Không có lô sắp hết hạn
              </p>
            ) : (
              expirationBatches.map((batch) => {
                const label = daysLabel(batch.daysUntilExpiration ?? 0);
                return (
                  <div
                    key={batch.id}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-container-low"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        label.danger ? "bg-error/10" : "bg-tertiary-container"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${
                          label.danger ? "text-error" : "text-on-tertiary"
                        }`}
                      >
                        schedule
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {batch.product?.name ?? "—"}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Còn lại: {batch.remainingQty} {batch.product?.unit ?? ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        label.danger
                          ? "bg-error/10 text-error"
                          : "bg-tertiary-container text-on-tertiary"
                      }`}
                    >
                      {label.text}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Recent orders table ── */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="font-[family-name:var(--font-hanken)] text-lg font-semibold text-on-surface">
            Đơn hàng mới nhất
          </h2>
          <a
            href="/orders"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Xem tất cả
            <span className="material-symbols-outlined text-base">
              chevron_right
            </span>
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-outline-variant/30">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Mã đơn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Khách hàng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Ngày đặt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Giá trị
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-on-surface-variant"
                  >
                    Chưa có đơn hàng nào
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="data-table-row border-b border-outline-variant/20 transition-colors hover:bg-surface-container-low/50"
                  >
                    <td className="px-6 py-4">
                      <a
                        href={`/orders`}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {order.orderCode}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-xs font-semibold text-primary">
                            {getInitials(order.customer?.name ?? "?")}
                          </span>
                        </div>
                        <span className="text-sm text-on-surface">
                          {order.customer?.name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-on-surface">
                      {formatCurrencyFull(order.finalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status as OrderStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
