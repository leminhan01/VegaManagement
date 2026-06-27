"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Category, PaginatedResponse, Product } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";
import { ImportProductsModal } from "./import-modal";

type ProductStatus = "all" | "active" | "inactive";

type ProductForm = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  price: string;
  salePrice: string;
  stock: string;
  minStock: string;
  unit: string;
  origin: string;
  shortDesc: string;
  description: string;
  tags: string;
  allergens: string;
  images: string[];
  isActive: boolean;
};

type AlertDialogState = {
  open: boolean;
  product: Product | null;
};

const emptyForm: ProductForm = {
  name: "",
  slug: "",
  sku: "",
  categoryId: "",
  price: "",
  salePrice: "",
  stock: "0",
  minStock: "10",
  unit: "cái",
  origin: "",
  shortDesc: "",
  description: "",
  tags: "",
  allergens: "",
  images: [],
  isActive: true,
};

const emptyAlert: AlertDialogState = {
  open: false,
  product: null,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function listFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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

function AlertDialog({
  state,
  loading,
  onCancel,
  onConfirm,
}: {
  state: AlertDialogState;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!state.open || !state.product) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="product-alert-title"
        aria-describedby="product-alert-description"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start gap-4 px-6 py-5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-error-container text-on-error-container">
            <span className="material-symbols-outlined text-[22px]">warning</span>
          </div>
          <div>
            <h3 id="product-alert-title" className="text-base font-semibold text-on-surface">
              Xác nhận xóa sản phẩm
            </h3>
            <p
              id="product-alert-description"
              className="mt-1 text-sm leading-relaxed text-on-surface-variant"
            >
              Bạn có chắc muốn xóa sản phẩm{" "}
              <span className="font-semibold text-on-surface">{state.product.name}</span>? Thao tác
              này không thể hoàn tác.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-outline-variant/50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-on-error transition-all hover:bg-error/90 active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Xóa sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<ProductStatus>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>(emptyAlert);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: "createdAt",
        order: "desc",
      });
      if (search.trim()) params.set("search", search.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (status !== "all") params.set("isActive", String(status === "active"));
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      const res = (await apiClient.getProducts(
        params.toString()
      )) as PaginatedResponse<Product> | null;

      if (res) {
        setProducts(res.data);
        setTotal(res.meta.total);
        setTotalPages(Math.max(1, res.meta.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [categoryId, limit, maxPrice, minPrice, page, search, status]);

  const fetchCategories = useCallback(async () => {
    const res = (await apiClient.getCategories(
      "page=1&limit=100&isActive=true"
    )) as PaginatedResponse<Category> | null;
    if (res) setCategories(res.data);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCategories().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCategories]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchProducts();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProducts]);

  const stats = useMemo(() => {
    const active = products.filter((item) => item.isActive).length;
    const lowStock = products.filter(
      (item) => item.stock > 0 && item.stock <= item.minStock
    ).length;
    const value = products.reduce((sum, item) => sum + item.price * item.stock, 0);
    return { active, lowStock, value };
  }, [products]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      categoryId: product.categoryId,
      price: String(product.price),
      salePrice: product.salePrice ? String(product.salePrice) : "",
      stock: String(product.stock),
      minStock: String(product.minStock),
      unit: product.unit,
      origin: product.origin || "",
      shortDesc: product.shortDesc || "",
      description: product.description || "",
      tags: product.tags?.join(", ") || "",
      allergens: product.allergens?.join(", ") || "",
      images: product.images || [],
      isActive: product.isActive,
    });
    setError("");
    setModalOpen(true);
  };

  const updateForm = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      name: value,
      slug: editingProduct ? current.slug : slugify(value),
    }));
  };

  const handleImageUpload = async (files?: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const uploadedImages = await Promise.all(
        selectedFiles.map((file) => apiClient.uploadProductImage(file))
      );
      const urls = uploadedImages
        .map((uploaded) => uploaded?.url)
        .filter((url): url is string => Boolean(url));
      if (urls.length > 0) {
        setForm((current) => ({
          ...current,
          images: [...urls, ...current.images],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setForm((current) => ({
      ...current,
      images: current.images.filter((image) => image !== url),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      sku: form.sku.trim(),
      categoryId: form.categoryId,
      price: Number(form.price || 0),
      salePrice: form.salePrice ? Number(form.salePrice) : undefined,
      stock: Number(form.stock || 0),
      minStock: Number(form.minStock || 0),
      unit: form.unit.trim() || "cái",
      origin: form.origin.trim() || undefined,
      shortDesc: form.shortDesc.trim() || undefined,
      description: form.description.trim(),
      tags: listFromText(form.tags),
      allergens: listFromText(form.allergens),
      images: form.images,
      isActive: form.isActive,
    };

    try {
      if (editingProduct) {
        await apiClient.updateProduct(editingProduct.id, payload);
      } else {
        await apiClient.createProduct(payload);
      }
      setModalOpen(false);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được sản phẩm");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (product: Product) => {
    setAlertDialog({ open: true, product });
  };

  const handleDelete = async () => {
    if (!alertDialog.product) return;
    setDeleting(true);
    setError("");
    try {
      await apiClient.deleteProduct(alertDialog.product.id);
      setAlertDialog(emptyAlert);
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được sản phẩm");
    } finally {
      setDeleting(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccess(message);
    setError("");
    window.setTimeout(() => setSuccess(""), 3000);
  };

  const handleEmbed = async (product: Product) => {
    setPendingId(product.id);
    setError("");
    try {
      const res = (await apiClient.embedProduct(product.id)) as
        | { success?: boolean }
        | null;
      if (res?.success) {
        showSuccess(`Đã tạo embedding cho "${product.name}"`);
      } else {
        setError(
          `Không tạo được embedding cho "${product.name}". Hãy kiểm tra chatbot service đang chạy.`
        );
      }
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được embedding");
    } finally {
      setPendingId(null);
    }
  };

  const handleTogglePublish = async (product: Product) => {
    setPendingId(product.id);
    setError("");
    try {
      if (product.isPublished) {
        await apiClient.unpublishProduct(product.id);
        showSuccess(`Đã gỡ "${product.name}" khỏi chatbot`);
      } else {
        await apiClient.publishProduct(product.id);
        showSuccess(`Đã đăng "${product.name}" lên chatbot`);
      }
      await fetchProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không cập nhật được trạng thái đăng"
      );
    } finally {
      setPendingId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryId("");
    setStatus("all");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const pages = useMemo(() => {
    const result: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
      return result;
    }
    result.push(1);
    if (page > 3) result.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      result.push(i);
    }
    if (page < totalPages - 2) result.push("...");
    result.push(totalPages);
    return result;
  }, [page, totalPages]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[28px] font-semibold leading-tight text-on-surface">
            Quản lý Sản phẩm
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Thêm, sửa, xóa, tìm kiếm và quản lý hình ảnh sản phẩm trên Cloudinary.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-primary/5 hover:shadow-md active:scale-[0.97]"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Nhập từ Excel
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.97]"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          icon="inventory_2"
          iconBgColor="bg-primary-fixed"
          iconTextColor="text-on-primary-fixed"
          label="Tổng sản phẩm"
          value={formatNumber(total)}
        />
        <StatCard
          icon="check_circle"
          iconBgColor="bg-secondary-container"
          iconTextColor="text-on-secondary-container"
          label="Đang bán trên trang này"
          value={String(stats.active)}
        />
        <StatCard
          icon="payments"
          iconBgColor="bg-tertiary-fixed"
          iconTextColor="text-on-tertiary-fixed"
          label="Giá trị tồn kho trang này"
          value={formatCurrency(stats.value)}
          subtitle={`${stats.lowStock} sản phẩm sắp hết`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
        {/* Filter bar */}
        <div className="border-b border-outline-variant/50 bg-surface-container-low/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search — takes remaining width */}
            <label className="relative min-w-[220px] flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
                search
              </span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo tên sản phẩm..."
                className="h-10 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {/* Dropdowns */}
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
              className="h-10 min-w-[160px] rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ProductStatus);
                setPage(1);
              }}
              className="h-10 min-w-[150px] rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang bán</option>
              <option value="inactive">Đã ẩn</option>
            </select>

            {/* Price range — grouped visually */}
            <div className="flex items-center gap-1.5">
              <input
                value={minPrice}
                onChange={(event) => {
                  setMinPrice(event.target.value);
                  setPage(1);
                }}
                type="number"
                min="0"
                placeholder="Giá từ"
                className="h-10 w-[110px] rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-on-surface-variant/40">—</span>
              <input
                value={maxPrice}
                onChange={(event) => {
                  setMaxPrice(event.target.value);
                  setPage(1);
                }}
                type="number"
                min="0"
                placeholder="Giá đến"
                className="h-10 w-[110px] rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3.5 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container hover:border-outline active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              Xóa lọc
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-error/20 bg-error-container/80 px-5 py-3">
            <span className="material-symbols-outlined text-[18px] text-error">error</span>
            <p className="text-sm font-medium text-on-error-container">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 border-b border-primary/20 bg-primary-fixed px-5 py-3">
            <span className="material-symbols-outlined text-[18px] text-on-primary-fixed">check_circle</span>
            <p className="text-sm font-medium text-on-primary-fixed">{success}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/60 bg-surface-container/60">
                <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant">Sản phẩm</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant">Danh mục</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-on-surface-variant">Giá</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-on-surface-variant">Tồn kho</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant">Trạng thái</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-on-surface-variant">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {loading ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-lg bg-outline-variant/30" />
                          <div className="space-y-2">
                            <div className="h-4 w-36 rounded bg-outline-variant/30" />
                            <div className="h-3 w-20 rounded bg-outline-variant/20" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-outline-variant/20" /></td>
                      <td className="px-5 py-4 text-right"><div className="ml-auto h-4 w-20 rounded bg-outline-variant/30" /></td>
                      <td className="px-5 py-4 text-right"><div className="ml-auto h-4 w-16 rounded bg-outline-variant/20" /></td>
                      <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-outline-variant/20" /></td>
                      <td className="px-5 py-4"><div className="ml-auto flex gap-2"><div className="h-8 w-8 rounded-lg bg-outline-variant/20" /><div className="h-8 w-8 rounded-lg bg-outline-variant/20" /></div></td>
                    </tr>
                  ))}
                </>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container">
                        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">inventory_2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-on-surface">Không có sản phẩm phù hợp</p>
                        <p className="mt-1 text-sm text-on-surface-variant">Thử thay đổi bộ lọc hoặc thêm sản phẩm mới</p>
                      </div>
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-all hover:bg-primary-container hover:text-on-primary-container active:scale-[0.97]"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Thêm sản phẩm
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="transition-colors duration-150 hover:bg-primary/[0.03]">
                    <td className="px-5 py-3.5">
                      <Link href={`/products/detail?id=${product.id}`} className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                                image
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-on-surface">{product.name}</p>
                          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-on-surface-variant">
                            {product.sku}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-on-surface-variant">
                      {product.category?.name || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="text-sm font-semibold text-on-surface">
                        {formatCurrency(product.salePrice || product.price)}
                      </p>
                      {product.salePrice ? (
                        <p className="text-[11px] text-on-surface-variant/70 line-through">
                          {formatCurrency(product.price)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <p className={`text-sm font-semibold tabular-nums ${product.stock <= product.minStock ? "text-error" : "text-on-surface"}`}>
                        {formatNumber(product.stock)} <span className="text-on-surface-variant">{product.unit}</span>
                      </p>
                      <p className="text-[11px] text-on-surface-variant/60">min: {product.minStock}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            product.isActive
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-error-container/80 text-on-error-container"
                          }`}
                        >
                          {product.isActive ? "Đang bán" : "Đã ẩn"}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            product.isPublished
                              ? "bg-primary-container text-on-primary-container"
                              : "bg-surface-container-highest text-on-surface-variant"
                          }`}
                          title={
                            product.isPublished
                              ? "Đang hiển thị cho chatbot"
                              : "Chưa đăng lên chatbot"
                          }
                        >
                          {product.isPublished ? "Đã đăng" : "Chưa đăng"}
                        </span>
                        {product.embeddedAt ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-on-surface-variant"
                            title={`Embedding: ${new Date(product.embeddedAt).toLocaleString("vi-VN")}`}
                          >
                            <span className="material-symbols-outlined text-[14px] text-primary">neurology</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-on-surface-variant/60"
                            title="Chưa có embedding"
                          >
                            <span className="material-symbols-outlined text-[14px]">cloud_off</span>
                          </span>
                        )}
                        {product.stock > 0 && product.stock <= product.minStock && (
                          <span className="inline-flex rounded-full bg-warning-container px-2 py-0.5 text-[11px] font-semibold text-on-warning-container">
                            Sắp hết
                          </span>
                        )}
                        {product.stock === 0 && (
                          <span className="inline-flex rounded-full bg-error-container px-2 py-0.5 text-[11px] font-semibold text-on-error-container">
                            Hết hàng
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEmbed(product)}
                          disabled={pendingId === product.id}
                          title="Tạo/cập nhật embedding cho chatbot"
                          className="rounded-lg p-2 text-on-surface-variant transition-all hover:bg-primary-fixed hover:text-on-primary-fixed active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                        >
                          <span
                            className={`material-symbols-outlined text-[20px] ${pendingId === product.id ? "animate-spin" : ""}`}
                          >
                            {pendingId === product.id ? "progress_activity" : "auto_awesome"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(product)}
                          disabled={
                            pendingId === product.id ||
                            (!product.isPublished && !product.embeddedAt)
                          }
                          title={
                            !product.isPublished && !product.embeddedAt
                              ? "Cần embed trước khi đăng"
                              : product.isPublished
                                ? "Gỡ khỏi chatbot"
                                : "Đăng lên chatbot"
                          }
                          className={`rounded-lg p-2 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
                            product.isPublished
                              ? "bg-primary-container text-on-primary-container hover:bg-primary/90"
                              : "text-on-surface-variant hover:bg-primary-fixed hover:text-on-primary-fixed"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {product.isPublished ? "rocket_launch" : "rocket"}
                          </span>
                        </button>
                        <Link
                          href={`/products/detail?id=${product.id}`}
                          title="Chi tiết"
                          className="rounded-lg p-2 text-on-surface-variant transition-all hover:bg-primary-fixed hover:text-on-primary-fixed active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          title="Sửa"
                          className="rounded-lg p-2 text-on-surface-variant transition-all hover:bg-primary-fixed hover:text-on-primary-fixed active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(product)}
                          title="Xóa"
                          className="rounded-lg p-2 text-on-surface-variant transition-all hover:bg-error-container hover:text-on-error-container active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant/50 bg-surface-container-low/30 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface-variant">
            Hiển thị <span className="font-semibold text-on-surface">{products.length}</span> trên tổng số{" "}
            <span className="font-semibold text-on-surface">{formatNumber(total)}</span> sản phẩm
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="h-9 rounded-lg border border-outline-variant bg-white px-2.5 text-sm text-on-surface outline-none focus:border-primary"
            >
              <option value={10}>10 / trang</option>
              <option value={25}>25 / trang</option>
              <option value={50}>50 / trang</option>
            </select>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            {pages.map((item, index) =>
              item === "..." ? (
                <span key={`dots-${index}`} className="flex h-9 w-9 items-center justify-center text-sm text-on-surface-variant/50">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item as number)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                    page === item
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between border-b border-outline-variant/50 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">
                    {editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm"}
                  </h3>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    Ảnh tải lên sẽ được lưu trên Cloudinary.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="grid gap-x-5 gap-y-4 p-6 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Tên sản phẩm</span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Slug</span>
                  <input
                    required
                    value={form.slug}
                    onChange={(event) => updateForm("slug", slugify(event.target.value))}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">SKU</span>
                  <input
                    required
                    value={form.sku}
                    onChange={(event) => updateForm("sku", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Danh mục</span>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(event) => updateForm("categoryId", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Giá bán</span>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(event) => updateForm("price", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Giá khuyến mãi</span>
                  <input
                    type="number"
                    min="0"
                    value={form.salePrice}
                    onChange={(event) => updateForm("salePrice", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Tồn kho</span>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(event) => updateForm("stock", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-on-surface-variant">Tối thiểu</span>
                    <input
                      type="number"
                      min="0"
                      value={form.minStock}
                      onChange={(event) => updateForm("minStock", event.target.value)}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-on-surface-variant">Đơn vị</span>
                    <input
                      value={form.unit}
                      onChange={(event) => updateForm("unit", event.target.value)}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </div>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Xuất xứ</span>
                  <input
                    value={form.origin}
                    onChange={(event) => updateForm("origin", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="flex items-center gap-3 pt-7">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm("isActive", event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-medium text-on-surface-variant">Đang bán</span>
                </label>

                {/* Section divider for long text fields */}
                <div className="md:col-span-2">
                  <div className="mb-3 mt-2 border-t border-outline-variant/30 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">Mô tả & chi tiết</p>
                  </div>
                </div>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-on-surface-variant">Mô tả ngắn</span>
                  <input
                    value={form.shortDesc}
                    onChange={(event) => updateForm("shortDesc", event.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-on-surface-variant">Mô tả chi tiết</span>
                  <textarea
                    required
                    rows={4}
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Tags</span>
                  <input
                    value={form.tags}
                    onChange={(event) => updateForm("tags", event.target.value)}
                    placeholder="rau củ, hữu cơ"
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-on-surface-variant">Dị ứng</span>
                  <input
                    value={form.allergens}
                    onChange={(event) => updateForm("allergens", event.target.value)}
                    placeholder="đậu nành, gluten"
                    className="h-10 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>

                {/* Image section */}
                <div className="space-y-3 md:col-span-2">
                  <div className="mt-2 border-t border-outline-variant/30 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">Hình ảnh</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-on-surface-variant">Hình ảnh sản phẩm</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/60 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-secondary-container active:scale-[0.97]">
                      <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                      {uploading ? "Đang tải lên..." : "Tải ảnh"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploading}
                        onChange={(event) => handleImageUpload(event.target.files)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {form.images.map((image) => (
                      <div key={image} className="group relative aspect-square overflow-hidden rounded-lg border border-outline-variant bg-surface">
                        <img src={image} alt="Sản phẩm" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(image)}
                          className="absolute right-2 top-2 rounded-full bg-error/90 p-1 text-on-error opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                    {form.images.length === 0 && (
                      <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-outline-variant/60 text-sm text-on-surface-variant/50">
                        Chưa có ảnh
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-outline-variant/50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu sản phẩm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog
        state={alertDialog}
        loading={deleting}
        onCancel={() => setAlertDialog(emptyAlert)}
        onConfirm={handleDelete}
      />

      <ImportProductsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => fetchProducts()}
      />
    </div>
  );
}
