"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ExpirationAlert,
  FifoFefoSuggestion,
  PaginatedResponse,
  Product,
  Warehouse,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { ExpirationBadge } from "@/components/shared/expiration-badge";
import { BatchStatusBadge } from "@/components/shared/batch-status-badge";
import { StatCard } from "@/components/shared/stat-card";

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function ExpirationPage() {
  const [alerts, setAlerts] = useState<ExpirationAlert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suggestion, setSuggestion] = useState<FifoFefoSuggestion | null>(null);
  const [daysThreshold, setDaysThreshold] = useState("30");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAlerts = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({
        daysThreshold: daysThreshold || "30",
      });
      if (productId) params.set("productId", productId);
      if (warehouseId) params.set("warehouseId", warehouseId);
      const res = (await apiClient.getExpirationAlerts(params.toString())) as
        | ExpirationAlert[]
        | null;
      if (res) setAlerts(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được cảnh báo hạn dùng");
    }
  }, [daysThreshold, productId, warehouseId]);

  const fetchLookups = useCallback(async () => {
    const [productRes, warehouseRes] = await Promise.all([
      apiClient.getProducts("page=1&limit=100&isActive=true&sort=name&order=asc"),
      apiClient.getWarehouses(),
    ]);
    const productData = productRes as PaginatedResponse<Product> | null;
    const warehouseData = warehouseRes as Warehouse[] | null;
    if (productData) setProducts(productData.data);
    if (warehouseData) setWarehouses(warehouseData);
  }, []);

  useEffect(() => {
    fetchLookups().catch(() => undefined);
  }, [fetchLookups]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchAlerts, 200);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAlerts]);

  const getSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const params = new URLSearchParams({
        productId,
        quantity: String(Number(quantity || 0)),
      });
      if (warehouseId) params.set("warehouseId", warehouseId);
      const res = (await apiClient.getFifoFefoSuggestion(
        params.toString()
      )) as FifoFefoSuggestion | null;
      if (res) setSuggestion(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lấy được gợi ý FIFO/FEFO");
    } finally {
      setSaving(false);
    }
  };

  const consumeSuggestion = async () => {
    if (!suggestion) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.consumeBatches({
        productId,
        warehouseId: warehouseId || undefined,
        items: suggestion.allocations.map((item) => ({
          batchId: item.batchId,
          quantity: item.quantity,
        })),
        reason: `${suggestion.strategy} allocation`,
        reference: `${suggestion.strategy}-${Date.now()}`,
      });
      setSuggestion(null);
      setQuantity("");
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xuất lô được");
    } finally {
      setSaving(false);
    }
  };

  const expired = alerts.filter((alert) => alert.daysUntilExpiration < 0);
  const critical = alerts.filter(
    (alert) => alert.daysUntilExpiration >= 0 && alert.daysUntilExpiration <= 7
  );

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
          Hạn sử dụng & FIFO/FEFO
        </h2>
        <p className="mt-1 text-on-surface-variant">
          Theo dõi lô gần hết hạn và gợi ý xuất hàng theo FIFO hoặc FEFO.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon="event_busy" iconBgColor="bg-error-container" iconTextColor="text-on-error-container" label="Đã hết hạn" value={formatNumber(expired.length)} variant="error" />
        <StatCard icon="priority_high" iconBgColor="bg-tertiary-fixed" iconTextColor="text-on-tertiary-fixed" label="Cần xử lý trong 7 ngày" value={formatNumber(critical.length)} />
        <StatCard icon="inventory" iconBgColor="bg-secondary-container" iconTextColor="text-on-secondary-container" label="Tổng lô cảnh báo" value={formatNumber(alerts.length)} subtitle={`${daysThreshold || 30} ngày tới`} />
      </div>

      {error && <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
          <div className="grid gap-3 border-b border-outline-variant/50 bg-surface-container-low/40 p-4 md:grid-cols-[130px_1fr_200px]">
            <input type="number" min="1" value={daysThreshold} onChange={(event) => setDaysThreshold(event.target.value)} className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" />
            <select value={productId} onChange={(event) => setProductId(event.target.value)} className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
              <option value="">Tất cả sản phẩm</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.sku}</option>)}
            </select>
            <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
              <option value="">Tất cả kho</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
                <tr>
                  <th className="px-5 py-4 text-xs font-bold uppercase">Lô hàng</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase">Sản phẩm</th>
                  <th className="px-5 py-4 text-right text-xs font-bold uppercase">Còn lại</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase">Hạn dùng</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {alerts.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-16 text-center text-on-surface-variant">Không có lô cần cảnh báo.</td></tr>
                ) : alerts.map((batch) => (
                  <tr key={batch.id} className="transition-colors hover:bg-primary/[0.04]">
                    <td className="px-5 py-4"><p className="font-semibold text-on-surface">{batch.batchCode}</p><p className="text-xs text-on-surface-variant">{batch.warehouse?.name || "Tổng kho"}</p></td>
                    <td className="px-5 py-4"><p className="font-semibold text-on-surface">{batch.product.name}</p><p className="font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">{batch.product.sku}</p></td>
                    <td className="px-5 py-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold">{formatNumber(batch.remainingQty)}</td>
                    <td className="px-5 py-4"><ExpirationBadge expirationDate={batch.expirationDate} /><p className="mt-1 text-xs text-on-surface-variant">{formatDate(batch.expirationDate)}</p></td>
                    <td className="px-5 py-4"><BatchStatusBadge status={batch.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
          <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
            <h3 className="text-base font-semibold text-on-surface">Gợi ý FIFO/FEFO</h3>
            <p className="text-sm text-on-surface-variant">Chọn sản phẩm và số lượng cần xuất để hệ thống đề xuất lô.</p>
          </div>
          <form onSubmit={getSuggestion} className="grid gap-4 p-5">
            <select required value={productId} onChange={(event) => setProductId(event.target.value)} className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
              <option value="">Chọn sản phẩm</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.sku}</option>)}
            </select>
            <input required type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Số lượng cần xuất" className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" />
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Lấy gợi ý
            </button>
          </form>
          {suggestion && (
            <div className="border-t border-outline-variant px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">{suggestion.strategy}</span>
                <span className="text-sm text-on-surface-variant">Thiếu: {formatNumber(suggestion.shortage)}</span>
              </div>
              <div className="space-y-2">
                {suggestion.allocations.map((item) => (
                  <div key={item.batchId} className="rounded-lg border border-outline-variant/60 bg-surface-container-low/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-on-surface">{item.batchCode}</p>
                      <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold">{formatNumber(item.quantity)}</p>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">Hạn dùng: {formatDate(item.expirationDate)}</p>
                  </div>
                ))}
              </div>
              <button type="button" disabled={saving || suggestion.allocations.length === 0 || suggestion.shortage > 0} onClick={consumeSuggestion} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">output</span>
                Xuất theo gợi ý
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
