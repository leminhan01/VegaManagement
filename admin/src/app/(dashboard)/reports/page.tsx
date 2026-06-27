"use client";

import { useEffect, useState } from "react";
import type { AdvancedInventoryReport } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ReportsPage() {
  const [report, setReport] = useState<AdvancedInventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    apiClient
      .getAdvancedInventoryReport()
      .then((res) => {
        if (mounted) setReport(res as AdvancedInventoryReport | null);
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Không tải được báo cáo");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
          Báo cáo nâng cao
        </h2>
        <p className="mt-1 text-on-surface-variant">
          Tổng hợp giá trị tồn kho, hạn sử dụng, biến động kho và hiệu suất lô hàng.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center text-on-surface-variant">
          Đang tải báo cáo...
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              icon="payments"
              iconBgColor="bg-primary-fixed"
              iconTextColor="text-on-primary-fixed"
              label="Giá trị tồn kho"
              value={formatCurrency(report.inventoryValue.totalValue)}
              subtitle={`${formatNumber(report.inventoryValue.totalStock)} đơn vị`}
            />
            <StatCard
              icon="event_busy"
              iconBgColor="bg-error-container"
              iconTextColor="text-on-error-container"
              label="Lô hết hạn"
              value={formatNumber(report.expiration.expiredCount)}
              subtitle={`${formatNumber(report.expiration.expiringSoonCount)} lô sắp hết`}
              variant="error"
            />
            <StatCard
              icon="swap_vert"
              iconBgColor="bg-secondary-container"
              iconTextColor="text-on-secondary-container"
              label="Biến động 30 ngày"
              value={formatNumber(report.movement.totalMovements)}
              subtitle={`IN ${formatNumber(report.movement.byType.IN ?? 0)} / OUT ${formatNumber(report.movement.byType.OUT ?? 0)}`}
            />
            <StatCard
              icon="inventory"
              iconBgColor="bg-tertiary-fixed"
              iconTextColor="text-on-tertiary-fixed"
              label="Tổng lô hàng"
              value={formatNumber(report.batch.totalBatches)}
              subtitle={`${formatNumber(report.batch.activeQuantity)} đơn vị active`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
                <h3 className="text-base font-semibold text-on-surface">Giá trị theo danh mục</h3>
              </div>
              <div className="divide-y divide-outline-variant">
                {report.inventoryValue.byCategory.map((item) => (
                  <div key={item.categoryId ?? "none"} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-on-surface">{item.categoryName}</p>
                        <p className="text-xs text-on-surface-variant">{formatNumber(item.stock)} đơn vị</p>
                      </div>
                      <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-primary">
                        {formatCurrency(item.value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
                <h3 className="text-base font-semibold text-on-surface">Top sản phẩm tồn giá trị cao</h3>
              </div>
              <div className="divide-y divide-outline-variant">
                {report.inventoryValue.topProducts.map((item) => (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-on-surface">{item.name}</p>
                        <p className="font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-primary">
                          {formatCurrency(item.value)}
                        </p>
                        <p className="text-xs text-on-surface-variant">{formatNumber(item.stock)} đơn vị</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
                <h3 className="text-base font-semibold text-on-surface">Biến động theo ngày</h3>
              </div>
              <div className="divide-y divide-outline-variant">
                {report.movement.byDay.map((item) => (
                  <div key={item.day} className="grid grid-cols-4 gap-3 px-5 py-3 text-sm">
                    <span className="font-[family-name:var(--font-jetbrains)] text-on-surface-variant">{item.day}</span>
                    <span className="text-secondary">Nhập {formatNumber(item.in)}</span>
                    <span className="text-error">Xuất {formatNumber(item.out)}</span>
                    <span className="text-on-surface-variant">Chỉnh {formatNumber(item.adjustment)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
                <h3 className="text-base font-semibold text-on-surface">Trạng thái lô hàng</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5">
                {Object.entries(report.batch.byStatus).map(([status, count]) => (
                  <div key={status} className="rounded-lg border border-outline-variant/60 bg-surface-container-low/40 p-4">
                    <p className="text-xs font-bold text-on-surface-variant">{status}</p>
                    <p className="mt-1 font-[family-name:var(--font-hanken)] text-2xl font-semibold text-on-surface">
                      {formatNumber(count)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
