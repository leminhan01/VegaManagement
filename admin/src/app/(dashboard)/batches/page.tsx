"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  BatchStatus,
  PaginatedResponse,
  Product,
  ProductBatch,
  Supplier,
  Warehouse,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { BatchStatusBadge } from "@/components/shared/batch-status-badge";
import { ExpirationBadge } from "@/components/shared/expiration-badge";
import { StatCard } from "@/components/shared/stat-card";

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | BatchStatus>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    supplierId: "",
    warehouseId: "",
    initialQuantity: "",
    unitCost: "",
    expirationDate: "",
    manufactureDate: "",
    note: "",
  });

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const res = (await apiClient.getProductBatches(params.toString())) as
        | PaginatedResponse<ProductBatch>
        | null;
      if (res) {
        setBatches(res.data);
        setTotal(res.meta.total);
        setTotalPages(Math.max(1, res.meta.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lô hàng");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  const fetchLookups = useCallback(async () => {
    const [productRes, supplierRes, warehouseRes] = await Promise.all([
      apiClient.getProducts("page=1&limit=100&isActive=true&sort=name&order=asc"),
      apiClient.getSuppliers("page=1&limit=100&isActive=true"),
      apiClient.getWarehouses(),
    ]);
    const productData = productRes as PaginatedResponse<Product> | null;
    const supplierData = supplierRes as PaginatedResponse<Supplier> | null;
    const warehouseData = warehouseRes as Warehouse[] | null;
    if (productData) setProducts(productData.data);
    if (supplierData) setSuppliers(supplierData.data);
    if (warehouseData) setWarehouses(warehouseData);
  }, []);

  useEffect(() => {
    fetchLookups().catch(() => undefined);
  }, [fetchLookups]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchBatches, 200);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBatches]);

  const stats = useMemo(() => {
    const active = batches.filter((batch) => batch.status === "ACTIVE").length;
    const remaining = batches.reduce((sum, batch) => sum + batch.remainingQty, 0);
    const value = batches.reduce(
      (sum, batch) => sum + batch.remainingQty * (batch.unitCost ?? 0),
      0
    );
    return { active, remaining, value };
  }, [batches]);

  const saveBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.createProductBatch({
        productId: form.productId,
        supplierId: form.supplierId || undefined,
        warehouseId: form.warehouseId || undefined,
        initialQuantity: Number(form.initialQuantity || 0),
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        expirationDate: form.expirationDate || undefined,
        manufactureDate: form.manufactureDate || undefined,
        note: form.note.trim() || undefined,
      });
      setFormOpen(false);
      setForm({
        productId: "",
        supplierId: "",
        warehouseId: "",
        initialQuantity: "",
        unitCost: "",
        expirationDate: "",
        manufactureDate: "",
        note: "",
      });
      await fetchBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được lô hàng");
    } finally {
      setSaving(false);
    }
  };

  const expireBatch = async (batch: ProductBatch) => {
    setSaving(true);
    setError("");
    try {
      await apiClient.expireProductBatch(batch.id);
      await fetchBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được lô hàng");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
            Quản lý lô hàng
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Theo dõi lô nhập, hạn sử dụng, tồn còn lại và trạng thái xử lý.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Thêm lô hàng
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon="inventory" iconBgColor="bg-primary-fixed" iconTextColor="text-on-primary-fixed" label="Tổng lô hàng" value={formatNumber(total)} />
        <StatCard icon="check_circle" iconBgColor="bg-secondary-container" iconTextColor="text-on-secondary-container" label="Lô đang dùng trên trang" value={formatNumber(stats.active)} />
        <StatCard icon="payments" iconBgColor="bg-tertiary-fixed" iconTextColor="text-on-tertiary-fixed" label="Giá trị còn lại trên trang" value={formatCurrency(stats.value)} subtitle={`${formatNumber(stats.remaining)} đơn vị`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
        <div className="grid gap-3 border-b border-outline-variant/50 bg-surface-container-low/40 p-4 lg:grid-cols-[minmax(220px,1fr)_180px_auto]">
          <label className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm mã lô, sản phẩm hoặc SKU" className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm outline-none focus:border-primary" />
          </label>
          <select value={status} onChange={(event) => { setStatus(event.target.value as "" | BatchStatus); setPage(1); }} className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang dùng</option>
            <option value="EXPIRED">Hết hạn</option>
            <option value="CONSUMED">Đã dùng hết</option>
            <option value="RECALLED">Thu hồi</option>
          </select>
          <button type="button" onClick={() => { setSearch(""); setStatus(""); setPage(1); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            Xóa lọc
          </button>
        </div>

        {error && <div className="border-b border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase">Lô hàng</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Sản phẩm</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Còn lại</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Hạn dùng</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Kho</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Trạng thái</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-on-surface-variant">Đang tải dữ liệu...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-on-surface-variant">Chưa có lô hàng phù hợp.</td></tr>
              ) : batches.map((batch) => (
                <tr key={batch.id} className="transition-colors hover:bg-primary/[0.04]">
                  <td className="px-5 py-4"><p className="font-semibold text-on-surface">{batch.batchCode}</p><p className="text-xs text-on-surface-variant">Nhập {formatDate(batch.receivedAt)}</p></td>
                  <td className="px-5 py-4"><p className="font-semibold text-on-surface">{batch.product.name}</p><p className="font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">{batch.product.sku}</p></td>
                  <td className="px-5 py-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold">{formatNumber(batch.remainingQty)} / {formatNumber(batch.initialQuantity)}</td>
                  <td className="px-5 py-4"><ExpirationBadge expirationDate={batch.expirationDate} /></td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">{batch.warehouse ? `${batch.warehouse.name} (${batch.warehouse.code})` : "-"}</td>
                  <td className="px-5 py-4"><BatchStatusBadge status={batch.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" disabled={saving || batch.status === "EXPIRED"} onClick={() => expireBatch(batch)} className="rounded-lg p-2 text-error transition-colors hover:bg-error-container disabled:opacity-40" title="Đánh dấu hết hạn">
                      <span className="material-symbols-outlined text-[20px]">event_busy</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-outline-variant bg-surface-container-low/40 p-4">
          <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
          <span className="flex h-10 items-center px-2 text-sm font-semibold">{page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <form onSubmit={saveBatch}>
              <div className="flex items-center justify-between border-b border-outline-variant/50 px-6 py-5">
                <div><h3 className="text-lg font-semibold text-on-surface">Thêm lô hàng</h3><p className="text-sm text-on-surface-variant">Tạo lô nhập và cập nhật tồn kho.</p></div>
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined text-[20px]">close</span></button>
              </div>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Sản phẩm</span><select required value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.sku}</option>)}</select></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Số lượng nhập</span><input required type="number" min="1" value={form.initialQuantity} onChange={(event) => setForm((current) => ({ ...current, initialQuantity: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Nhà cung cấp</span><select value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"><option value="">Không chọn</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Kho</span><select value={form.warehouseId} onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"><option value="">Tổng kho</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}</select></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Đơn giá nhập</span><input type="number" min="0" value={form.unitCost} onChange={(event) => setForm((current) => ({ ...current, unitCost: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Hạn sử dụng</span><input type="date" value={form.expirationDate} onChange={(event) => setForm((current) => ({ ...current, expirationDate: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Ngày sản xuất</span><input type="date" value={form.manufactureDate} onChange={(event) => setForm((current) => ({ ...current, manufactureDate: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Ghi chú</span><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
              </div>
              <div className="flex justify-end gap-3 border-t border-outline-variant/50 px-6 py-4"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu lô hàng"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
