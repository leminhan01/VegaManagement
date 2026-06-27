"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { DashboardStats, OrderStatus } from "@/lib/types";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

// ── Helpers ──
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷđ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}trđ`;
  return value.toLocaleString("vi-VN") + "đ";
}

function formatTrend(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

// ── Skeleton loader ──
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-container-high rounded-lg ${className ?? ""}`}
    />
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await apiClient.getDashboardStats();
        if (data) {
          setStats(data as DashboardStats);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không thể tải dữ liệu dashboard"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        {/* Chart + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-72" />
          <Skeleton className="h-72" />
        </div>
        {/* Table */}
        <Skeleton className="h-80" />
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-error-container rounded-2xl p-6 flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-2xl mt-0.5">
            error
          </span>
          <div>
            <p className="font-medium text-error">Không thể tải dữ liệu</p>
            <p className="text-sm text-error/80 mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-1.5 bg-error text-on-error rounded-lg text-sm font-medium hover:bg-error/90 transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const maxRevenue = Math.max(...stats.revenueByDay.map((d) => d.revenue), 1);

  return (
    <div className="p-6 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-on-background font-[family-name:var(--font-hanken)]">
            Dashboard Tổng Quan
          </h1>
          <p className="text-on-surface-variant mt-0.5">
            Chào mừng trở lại
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined text-lg">
            calendar_today
          </span>
          Hôm nay
        </button>
      </div>

      {/* ── KPI StatCards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon="payments"
          iconBgColor="bg-secondary-container"
          iconTextColor="text-on-secondary-container"
          label="Doanh thu tháng này"
          value={formatCurrency(stats.revenue.current)}
          trend={formatTrend(stats.revenue.change)}
          trendColor="text-primary"
          trendBg="bg-primary/10"
          trendIcon="trending_up"
        />
        <StatCard
          icon="receipt_long"
          iconBgColor="bg-surface-container"
          iconTextColor="text-on-surface-variant"
          label="Tổng đơn hàng"
          value={stats.orders.thisMonth.toLocaleString("vi-VN")}
          trend={formatTrend(stats.orders.change)}
          trendColor="text-primary"
          trendBg="bg-primary/10"
          trendIcon="trending_up"
        />
        <StatCard
          icon="warning"
          iconBgColor="bg-error-container"
          iconTextColor="text-on-error-container"
          label="Sản phẩm sắp hết"
          value={stats.lowStockProducts.length.toString()}
          variant="error"
          subtitle={`${stats.lowStockProducts.filter((p) => p.stock === 0).length} hết hàng`}
        />
        <StatCard
          icon="person_add"
          iconBgColor="bg-primary-fixed"
          iconTextColor="text-on-primary-fixed"
          label="Khách hàng mới"
          value={stats.newCustomers.toLocaleString("vi-VN")}
          trend="+15.0%"
          trendColor="text-primary"
          trendBg="bg-primary/10"
          trendIcon="trending_up"
        />
      </div>

      {/* ── Main Content: Chart + Low Stock ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                Tăng trưởng doanh thu
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Doanh thu 7 ngày gần nhất
              </p>
            </div>
            <span className="text-sm font-medium text-primary">
              {formatCurrency(stats.revenue.current)}
            </span>
          </div>

          {/* CSS Bar Chart */}
          <div className="flex items-end gap-3 h-48">
            {stats.revenueByDay.map((item, index) => {
              const heightPercent = (item.revenue / maxRevenue) * 100;
              const today = new Date();
              const dayOfWeek = today.getDay();
              // Sunday=0 in JS, but our data is Mon-Sun
              const isToday =
                (dayOfWeek === 0 && index === 6) || dayOfWeek === index + 1;

              return (
                <div
                  key={item.day}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="relative w-full group">
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-on-surface text-surface text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {formatCurrency(item.revenue)}
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-colors ${
                        isToday
                          ? "bg-primary"
                          : "bg-primary/20 hover:bg-primary/40"
                      }`}
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Sidebar */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-on-surface">
              Sắp hết hàng
            </h2>
            <a
              href="/products"
              className="text-sm text-primary hover:underline font-medium"
            >
              Xem tất cả
            </a>
          </div>

          <div className="space-y-3">
            {stats.lowStockProducts.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                Không có sản phẩm sắp hết hàng
              </p>
            ) : (
              stats.lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-low transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-lg">
                      nutrition
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Tồn kho:{" "}
                      <span
                        className={`font-medium ${
                          product.stock === 0
                            ? "text-error"
                            : product.stock <= product.minStock
                              ? "text-error"
                              : "text-on-surface"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </p>
                  </div>

                  {/* Restock button */}
                  <a
                    href="/products"
                    className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    Nhập
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Orders Table ── */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        {/* Table Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-on-surface">
            Đơn hàng mới nhất
          </h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-lg">
              download
            </span>
            Xuất báo cáo
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-outline-variant/30">
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider px-6 py-3">
                  Mã đơn
                </th>
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider px-6 py-3">
                  Khách hàng
                </th>
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider px-6 py-3">
                  Ngày đặt
                </th>
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider px-6 py-3">
                  Giá trị
                </th>
                <th className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider px-6 py-3">
                  Trạng thái
                </th>
                <th className="text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider px-6 py-3">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-on-surface-variant"
                  >
                    Chưa có đơn hàng nào
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="data-table-row border-b border-outline-variant/20 hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-primary font-mono text-sm">
                        {order.orderCode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">
                            {getInitials(order.customerName)}
                          </span>
                        </div>
                        <span className="text-sm text-on-surface">
                          {order.customerName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-on-surface-variant">
                        {formatDate(order.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-on-surface">
                        {formatCurrency(order.finalAmount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status as OrderStatus} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-xl">
                          visibility
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {stats.recentOrders.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/30">
            <p className="text-sm text-on-surface-variant">
              Hiển thị{" "}
              <span className="font-medium text-on-surface">
                {stats.recentOrders.length}
              </span>{" "}
              trong{" "}
              <span className="font-medium text-on-surface">
                {stats.orders.total}
              </span>{" "}
              đơn hàng
            </p>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-40">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">
                  chevron_left
                </span>
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-sm font-medium">
                1
              </button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-surface-container text-sm text-on-surface-variant">
                2
              </button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-surface-container text-sm text-on-surface-variant">
                3
              </button>
              <button className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
