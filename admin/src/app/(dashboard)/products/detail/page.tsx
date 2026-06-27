"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type {
  PaginatedResponse,
  Product,
  ProductBatch,
  StockMovement,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";
import { BatchStatusBadge } from "@/components/shared/batch-status-badge";

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

function movementLabel(type: StockMovement["type"]) {
  if (type === "IN") return "Nhập kho";
  if (type === "OUT") return "Xuất kho";
  return "Điều chỉnh";
}

function ProductDetailContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const [productData, batchPage, movementPage] = await Promise.all([
        apiClient.getProduct(productId),
        apiClient.getProductBatches(`page=1&limit=20&productId=${productId}`),
        apiClient.getStockMovements(`page=1&limit=20&productId=${productId}`),
      ]);
      const loadedProduct = productData as Product | null;
      if (loadedProduct) {
        setProduct(loadedProduct);
        setSelectedImage(loadedProduct.images?.[0] ?? "");
      }
      const loadedBatches = batchPage as PaginatedResponse<ProductBatch> | null;
      if (loadedBatches) setBatches(loadedBatches.data);
      const loadedMovements = movementPage as PaginatedResponse<StockMovement> | null;
      if (loadedMovements) setMovements(loadedMovements.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const stockValue = useMemo(() => {
    if (!product) return 0;
    return product.stock * (product.salePrice ?? product.price);
  }, [product]);

  if (!productId) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Quay lại danh sách
        </Link>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-10 text-center">
          <h2 className="text-xl font-bold text-on-surface">Chưa chọn sản phẩm</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Vui lòng chọn một sản phẩm từ danh sách để xem chi tiết.
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
          <p className="mt-3 text-sm">Đang tải chi tiết sản phẩm...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Quay lại danh sách
        </Link>
        <div className="rounded-lg border border-error/30 bg-error-container p-6 text-on-error-container">
          {error || "Không tìm thấy sản phẩm."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <Link href="/products" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Quay lại danh sách
          </Link>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
            {product.name}
          </h2>
          <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-sm text-on-surface-variant">
            {product.sku} · {product.category?.name ?? "Chưa phân loại"}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
            product.isActive
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-error-container text-on-error-container"
          }`}
        >
          {product.isActive ? "Đang bán" : "Đã ẩn"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(360px,520px)_1fr]">
        <section className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px]">image</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {product.images?.map((image) => (
              <button
                key={image}
                type="button"
                onClick={() => setSelectedImage(image)}
                className={`aspect-square overflow-hidden rounded-lg border ${
                  selectedImage === image ? "border-primary ring-2 ring-primary/20" : "border-outline-variant"
                }`}
              >
                <img src={image} alt={product.name} className="h-full w-full object-cover" />
              </button>
            ))}
            {product.images.length === 0 && (
              <div className="col-span-5 rounded-lg border border-dashed border-outline-variant px-4 py-5 text-center text-sm text-on-surface-variant">
                Sản phẩm chưa có hình ảnh minh họa.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard icon="payments" iconBgColor="bg-primary-fixed" label="Giá bán" value={formatCurrency(product.salePrice ?? product.price)} />
            <StatCard icon="inventory_2" iconBgColor="bg-secondary-container" label="Tồn kho" value={`${formatNumber(product.stock)} ${product.unit}`} />
            <StatCard icon="account_balance_wallet" iconBgColor="bg-tertiary-fixed" label="Giá trị tồn" value={formatCurrency(stockValue)} />
            <StatCard icon="photo_library" iconBgColor="bg-surface-container-high" label="Ảnh minh họa" value={formatNumber(product.images.length)} />
          </div>

          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="font-bold text-on-surface">Mô tả sản phẩm</h3>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              {product.shortDesc || product.description}
            </p>
            {product.shortDesc && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
                {product.description}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
              <h3 className="font-bold text-on-surface">Thông tin</h3>
              <div className="mt-3 space-y-2 text-sm">
                <p><span className="text-on-surface-variant">Xuất xứ:</span> {product.origin ?? "-"}</p>
                <p><span className="text-on-surface-variant">Đơn vị:</span> {product.unit}</p>
                <p><span className="text-on-surface-variant">Tồn tối thiểu:</span> {formatNumber(product.minStock)}</p>
                <p><span className="text-on-surface-variant">Ngày tạo:</span> {formatDate(product.createdAt)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
              <h3 className="font-bold text-on-surface">Tags & dị ứng</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {tag}
                  </span>
                ))}
                {product.allergens.map((item) => (
                  <span key={item} className="rounded-full bg-error-container px-3 py-1 text-xs font-semibold text-on-error-container">
                    {item}
                  </span>
                ))}
                {product.tags.length === 0 && product.allergens.length === 0 && (
                  <span className="text-sm text-on-surface-variant">Chưa có tags hoặc thông tin dị ứng.</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-5 py-4 font-bold">
          Lô hàng
        </div>
        <div className="divide-y divide-outline-variant">
          {batches.length === 0 ? (
            <p className="px-5 py-6 text-sm text-on-surface-variant">Chưa có lô hàng cho sản phẩm này.</p>
          ) : (
            batches.map((batch) => (
              <div key={batch.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                <div>
                  <p className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-primary">{batch.batchCode}</p>
                  <p className="text-xs text-on-surface-variant">Nhận: {formatDate(batch.receivedAt)} · HSD: {formatDate(batch.expirationDate)}</p>
                </div>
                <BatchStatusBadge status={batch.status} />
                <p className="text-right text-sm font-semibold">{formatNumber(batch.remainingQty)} còn lại</p>
                <p className="text-right text-sm text-on-surface-variant">{batch.warehouse?.name ?? "-"}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low px-5 py-4 font-bold">
          Lịch sử kho gần đây
        </div>
        <div className="divide-y divide-outline-variant">
          {movements.length === 0 ? (
            <p className="px-5 py-6 text-sm text-on-surface-variant">Chưa có lịch sử kho cho sản phẩm này.</p>
          ) : (
            movements.map((movement) => (
              <div key={movement.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-semibold">{movementLabel(movement.type)}</p>
                  <p className="text-xs text-on-surface-variant">{formatDate(movement.createdAt)} · {movement.reason ?? "-"}</p>
                </div>
                <p className={`text-right text-sm font-bold ${movement.type === "OUT" ? "text-error" : "text-primary"}`}>
                  {movement.type === "OUT" ? "-" : "+"}{formatNumber(movement.quantity)}
                </p>
                <p className="text-right text-xs text-on-surface-variant">
                  {formatNumber(movement.beforeStock)} → {formatNumber(movement.afterStock)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetailContent />
    </Suspense>
  );
}
