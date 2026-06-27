"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Category, PaginatedResponse } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";

type CategoryStatus = "all" | "active" | "inactive";
type SortOrder = "newest" | "az" | "count";

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
};

type FormErrors = Partial<Record<keyof CategoryForm, string>>;

type AlertDialogState = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  tone: "danger" | "primary";
  category: Category | null;
};

const emptyForm: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  image: "",
  isActive: true,
};

const emptyAlert: AlertDialogState = {
  open: false,
  title: "",
  description: "",
  confirmText: "",
  tone: "danger",
  category: null,
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

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function getProductCount(category: Category) {
  return category.productCount ?? category._count?.products ?? 0;
}

function validateCategoryForm(form: CategoryForm): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  const slug = form.slug.trim();
  const image = form.image.trim();
  const description = form.description.trim();

  if (!name) errors.name = "Vui lòng nhập tên danh mục.";
  else if (name.length < 2) errors.name = "Tên danh mục cần ít nhất 2 ký tự.";
  else if (name.length > 255) errors.name = "Tên danh mục không quá 255 ký tự.";

  if (!slug) errors.slug = "Vui lòng nhập slug.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang.";
  } else if (slug.length > 255) {
    errors.slug = "Slug không quá 255 ký tự.";
  }

  if (description.length > 1000) {
    errors.description = "Mô tả không quá 1000 ký tự.";
  }

  if (image && !/^https?:\/\/\S+\.\S+/.test(image)) {
    errors.image = "URL hình ảnh phải bắt đầu bằng http:// hoặc https://.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-error">{message}</p>;
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
  if (!state.open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="category-alert-title"
        aria-describedby="category-alert-description"
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start gap-4 border-b border-outline-variant px-6 py-5">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
              state.tone === "danger"
                ? "bg-error-container text-on-error-container"
                : "bg-secondary-container text-on-secondary-container"
            }`}
          >
            <span className="material-symbols-outlined">
              {state.tone === "danger" ? "warning" : "help"}
            </span>
          </div>
          <div>
            <h3 id="category-alert-title" className="text-lg font-bold text-on-surface">
              {state.title}
            </h3>
            <p
              id="category-alert-description"
              className="mt-1 text-sm leading-6 text-on-surface-variant"
            >
              {state.description}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface-variant disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
              state.tone === "danger"
                ? "bg-error text-on-error"
                : "bg-primary text-on-primary"
            }`}
          >
            {loading ? "Đang xử lý..." : state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CategoryStatus>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>(emptyAlert);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("isActive", String(status === "active"));

      const res = (await apiClient.getCategories(
        params.toString()
      )) as PaginatedResponse<Category> | null;

      if (res) {
        setCategories(res.data);
        setTotal(res.meta.total);
        setTotalPages(Math.max(1, res.meta.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh mục");
    } finally {
      setLoading(false);
    }
  }, [limit, page, search, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCategories();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCategories]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (sortOrder === "az") return a.name.localeCompare(b.name, "vi");
      if (sortOrder === "count") return getProductCount(b) - getProductCount(a);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [categories, sortOrder]);

  const stats = useMemo(() => {
    const active = categories.filter((item) => item.isActive).length;
    const inactive = categories.filter((item) => !item.isActive).length;
    const products = categories.reduce((sum, item) => sum + getProductCount(item), 0);
    return { active, inactive, products };
  }, [categories]);

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

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setFormErrors({});
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image: category.image || "",
      isActive: category.isActive,
    });
    setFormErrors({});
    setError("");
    setModalOpen(true);
  };

  const updateForm = <K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      name: value,
      slug: editingCategory ? current.slug : slugify(value),
    }));
    setFormErrors((current) => ({ ...current, name: undefined, slug: undefined }));
  };

  const handleImageUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormErrors((current) => ({
        ...current,
        image: "Vui lòng chọn đúng định dạng hình ảnh.",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors((current) => ({
        ...current,
        image: "Hình ảnh không được vượt quá 5MB.",
      }));
      return;
    }

    setUploading(true);
    setError("");
    setFormErrors((current) => ({ ...current, image: undefined }));
    try {
      const uploaded = await apiClient.uploadProductImage(file);
      if (uploaded?.url) {
        setForm((current) => ({ ...current, image: uploaded.url }));
      }
    } catch (err) {
      setFormErrors((current) => ({
        ...current,
        image: err instanceof Error ? err.message : "Tải ảnh thất bại",
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedForm = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug.trim() || form.name),
      description: form.description.trim(),
      image: form.image.trim(),
    };
    const errors = validateCategoryForm(normalizedForm);
    setFormErrors(errors);
    setForm(normalizedForm);

    if (Object.keys(errors).length > 0) return;

    const payload = {
      name: normalizedForm.name,
      slug: normalizedForm.slug,
      description: normalizedForm.description || undefined,
      image: normalizedForm.image || undefined,
      isActive: normalizedForm.isActive,
    };

    setSaving(true);
    setError("");
    try {
      if (editingCategory) {
        await apiClient.updateCategory(editingCategory.id, payload);
      } else {
        await apiClient.createCategory(payload);
      }
      setModalOpen(false);
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được danh mục");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (category: Category) => {
    const count = getProductCount(category);
    setAlertDialog({
      open: true,
      title: "Xác nhận xóa danh mục",
      description:
        count > 0
          ? `Danh mục "${category.name}" đang có ${formatNumber(count)} sản phẩm. Thao tác này sẽ chuyển danh mục sang trạng thái đã ngừng để tránh ảnh hưởng dữ liệu sản phẩm.`
          : `Bạn có chắc muốn xóa danh mục "${category.name}"? Danh mục sẽ được chuyển sang trạng thái đã ngừng.`,
      confirmText: "Xóa danh mục",
      tone: "danger",
      category,
    });
  };

  const handleDelete = async () => {
    if (!alertDialog.category) return;
    setDeleting(true);
    setError("");
    try {
      await apiClient.deleteCategory(alertDialog.category.id);
      setAlertDialog(emptyAlert);
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được danh mục");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setSortOrder("newest");
    setPage(1);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
            Quản lý Danh mục
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Thêm, sửa, xóa, tìm kiếm và quản lý trạng thái các nhóm sản phẩm.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Thêm danh mục
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon="category"
          iconBgColor="bg-secondary-container"
          iconTextColor="text-on-secondary-container"
          label="Tổng danh mục"
          value={formatNumber(total)}
        />
        <StatCard
          icon="check_circle"
          iconBgColor="bg-primary-fixed"
          iconTextColor="text-on-primary-fixed"
          label="Đang hoạt động trên trang này"
          value={String(stats.active)}
        />
        <StatCard
          icon="inventory_2"
          iconBgColor="bg-tertiary-fixed"
          iconTextColor="text-on-tertiary-fixed"
          label="Sản phẩm trên trang này"
          value={formatNumber(stats.products)}
        />
        <StatCard
          icon="pause_circle"
          iconBgColor="bg-error-container"
          iconTextColor="text-on-error-container"
          label="Đã ngừng trên trang này"
          value={String(stats.inactive)}
          variant="error"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="grid gap-3 border-b border-outline-variant bg-surface-container-low/60 p-4 lg:grid-cols-[minmax(220px,1fr)_170px_190px_auto]">
          <label className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên danh mục"
              className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CategoryStatus);
              setPage(1);
            }}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã ngừng</option>
          </select>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          >
            <option value="newest">Sắp xếp: Mới nhất</option>
            <option value="az">Sắp xếp: Tên A-Z</option>
            <option value="count">Sắp xếp: Số sản phẩm</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">filter_alt_off</span>
            Xóa lọc
          </button>
        </div>

        {error && (
          <div className="border-b border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase">Danh mục</th>
                <th className="px-5 py-4 text-center text-xs font-bold uppercase">Sản phẩm</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Trạng thái</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Ngày tạo</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-on-surface-variant">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : sortedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-on-surface-variant">
                    Không có danh mục phù hợp.
                  </td>
                </tr>
              ) : (
                sortedCategories.map((category) => {
                  const productCount = getProductCount(category);
                  return (
                    <tr key={category.id} className="transition-colors hover:bg-primary/[0.04]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-outline-variant bg-surface">
                            {category.image ? (
                              <img
                                src={category.image}
                                alt={category.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <span className="material-symbols-outlined text-on-surface-variant">
                                  category
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-on-surface">
                              {category.name}
                            </p>
                            <p className="truncate font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">
                              {category.slug}
                            </p>
                            {category.description ? (
                              <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">
                                {category.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          {formatNumber(productCount)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            category.isActive
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-error-container text-on-error-container"
                          }`}
                        >
                          {category.isActive ? "Đang hoạt động" : "Đã ngừng"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">
                        {formatDate(category.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(category)}
                            title="Sửa"
                            className="rounded-lg p-2 text-primary transition-colors hover:bg-primary-fixed"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(category)}
                            title="Xóa"
                            className="rounded-lg p-2 text-error transition-colors hover:bg-error-container"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-outline-variant bg-surface-container-low/40 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-on-surface-variant">
            Hiển thị <span className="font-bold text-on-surface">{sortedCategories.length}</span> trên{" "}
            <span className="font-bold text-on-surface">{formatNumber(total)}</span> danh mục
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm"
            >
              <option value={10}>10 / trang</option>
              <option value={25}>25 / trang</option>
              <option value={50}>50 / trang</option>
            </select>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            {pages.map((item, index) =>
              item === "..." ? (
                <span key={`dots-${index}`} className="px-1 text-on-surface-variant">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item as number)}
                  className={`h-10 w-10 rounded-lg text-sm font-bold ${
                    page === item
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant bg-white text-on-surface-variant"
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
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <form onSubmit={handleSubmit} noValidate>
              <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
                <div>
                  <h3 className="text-xl font-bold text-on-surface">
                    {editingCategory ? "Sửa danh mục" : "Thêm danh mục"}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Slug sẽ được dùng trong URL và cần là duy nhất.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-2 hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-semibold">Tên danh mục</span>
                  <input
                    value={form.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    maxLength={255}
                    className={`h-11 w-full rounded-lg border px-3 outline-none focus:border-primary ${
                      formErrors.name ? "border-error" : "border-outline-variant"
                    }`}
                  />
                  <FieldError message={formErrors.name} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-semibold">Slug</span>
                  <input
                    value={form.slug}
                    onChange={(event) => updateForm("slug", slugify(event.target.value))}
                    maxLength={255}
                    placeholder="vi-du-danh-muc"
                    className={`h-11 w-full rounded-lg border px-3 outline-none focus:border-primary ${
                      formErrors.slug ? "border-error" : "border-outline-variant"
                    }`}
                  />
                  <FieldError message={formErrors.slug} />
                </label>
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Hình ảnh danh mục</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary-container">
                      <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                      {uploading ? "Đang tải lên..." : "Tải ảnh"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        onChange={(event) => handleImageUpload(event.target.files?.[0])}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[120px,1fr]">
                    <div className="flex aspect-square w-full max-w-[120px] overflow-hidden rounded-lg border border-outline-variant bg-surface">
                      {form.image ? (
                        <img
                          src={form.image}
                          alt="Danh mục"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                          <span className="material-symbols-outlined">category</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        value={form.image}
                        onChange={(event) => updateForm("image", event.target.value)}
                        placeholder="URL Cloudinary sau khi tải ảnh"
                        className={`h-11 w-full rounded-lg border px-3 outline-none focus:border-primary ${
                          formErrors.image ? "border-error" : "border-outline-variant"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <FieldError message={formErrors.image} />
                        {form.image ? (
                          <button
                            type="button"
                            onClick={() => updateForm("image", "")}
                            className="text-sm font-semibold text-error hover:underline"
                          >
                            Xóa ảnh
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-semibold">Mô tả</span>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    maxLength={1000}
                    className={`w-full rounded-lg border px-3 py-2 outline-none focus:border-primary ${
                      formErrors.description ? "border-error" : "border-outline-variant"
                    }`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <FieldError message={formErrors.description} />
                    <span className="ml-auto text-xs text-on-surface-variant">
                      {form.description.length}/1000
                    </span>
                  </div>
                </label>
                <label className="flex items-center gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm("isActive", event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-semibold">Đang hoạt động</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-outline-variant px-5 py-2.5 font-semibold text-on-surface-variant"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu danh mục"}
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
    </div>
  );
}
