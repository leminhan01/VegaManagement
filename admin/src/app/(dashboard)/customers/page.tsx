"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  Customer,
  CustomerGroups,
  CustomerStats,
  Order,
  PaginatedResponse,
  ShippingAddress,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  group: string;
  tags: string;
  note: string;
  shippingAddresses: ShippingAddress[];
};

type AlertState = {
  open: boolean;
  customer: Customer | null;
};

const GROUP_OPTIONS = [
  { value: "LEAD", label: "Tiềm năng" },
  { value: "REGULAR", label: "Thường" },
  { value: "LOYAL", label: "Thân thiết" },
  { value: "VIP", label: "VIP" },
  { value: "WHOLESALE", label: "Bán sỉ" },
];

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  group: "REGULAR",
  tags: "",
  note: "",
  shippingAddresses: [],
};

const emptyAlert: AlertState = {
  open: false,
  customer: null,
};

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

function listFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function groupClass(group?: string) {
  if (group === "VIP") return "bg-primary text-on-primary";
  if (group === "LOYAL") return "bg-secondary-container text-on-secondary-container";
  if (group === "WHOLESALE") return "bg-tertiary-fixed text-on-tertiary-fixed";
  if (group === "LEAD") return "bg-surface-container-high text-on-surface-variant";
  return "bg-primary/10 text-primary";
}

function AlertDialog({
  state,
  loading,
  onCancel,
  onConfirm,
}: {
  state: AlertState;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!state.open || !state.customer) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex gap-4 border-b border-outline-variant px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-error-container text-on-error-container">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">Xóa khách hàng</h3>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              Xóa khách hàng {state.customer.name}. Chỉ khách chưa có đơn hàng mới có thể xóa.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-on-error disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Xóa khách hàng"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroups | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [alert, setAlert] = useState<AlertState>(emptyAlert);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort: "createdAt",
      order: "desc",
    });
    if (search.trim()) params.set("search", search.trim());
    if (group) params.set("group", group);
    if (tag) params.set("tag", tag);
    if (minSpent) params.set("minSpent", minSpent);
    return params;
  }, [group, limit, minSpent, page, search, tag]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = (await apiClient.getCustomers(
        buildParams().toString()
      )) as PaginatedResponse<Customer> | null;
      if (res) {
        setCustomers(res.data);
        setTotal(res.meta.total);
        setTotalPages(Math.max(1, res.meta.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được khách hàng");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchGroups = useCallback(async () => {
    const data = (await apiClient.getCustomerGroups()) as CustomerGroups | null;
    if (data) setGroups(data);
  }, []);

  useEffect(() => {
    fetchGroups().catch(() => undefined);
  }, [fetchGroups]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCustomers();
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCustomers]);

  const stats = useMemo(() => {
    const totalSpent = customers.reduce((sum, customer) => sum + (customer.totalSpent ?? 0), 0);
    const vip = customers.filter((customer) => customer.group === "VIP").length;
    const active = customers.filter((customer) => (customer.activeOrders ?? 0) > 0).length;
    return { totalSpent, vip, active };
  }, [customers]);

  const pages = useMemo(() => {
    const result: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let index = 1; index <= totalPages; index += 1) result.push(index);
      return result;
    }
    result.push(1);
    if (page > 3) result.push("...");
    for (let index = Math.max(2, page - 1); index <= Math.min(totalPages - 1, page + 1); index += 1) {
      result.push(index);
    }
    if (page < totalPages - 2) result.push("...");
    result.push(totalPages);
    return result;
  }, [page, totalPages]);

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailLoading(true);
    setError("");
    try {
      const [detail, orders, statsData] = await Promise.all([
        apiClient.getCustomer(customer.id),
        apiClient.getCustomerOrders(customer.id, "page=1&limit=20"),
        apiClient.getCustomerStats(customer.id),
      ]);
      if (detail) setSelectedCustomer(detail as Customer);
      const ordersPage = orders as PaginatedResponse<Order> | null;
      if (ordersPage) setCustomerOrders(ordersPage.data);
      if (statsData) setCustomerStats(statsData as CustomerStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết khách hàng");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateForm = <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateAddress = (index: number, value: Partial<ShippingAddress>) => {
    setForm((current) => ({
      ...current,
      shippingAddresses: current.shippingAddresses.map((address, itemIndex) =>
        itemIndex === index ? { ...address, ...value } : address
      ),
    }));
  };

  const addAddress = () => {
    setForm((current) => ({
      ...current,
      shippingAddresses: [
        ...current.shippingAddresses,
        { label: "", receiverName: current.name, phone: current.phone, address: "" },
      ],
    }));
  };

  const removeAddress = (index: number) => {
    setForm((current) => ({
      ...current,
      shippingAddresses: current.shippingAddresses.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      address: customer.address ?? "",
      group: customer.group ?? "REGULAR",
      tags: customer.tags?.join(", ") ?? "",
      note: customer.note ?? "",
      shippingAddresses: customer.shippingAddresses ?? [],
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      group: form.group,
      tags: listFromText(form.tags),
      note: form.note.trim() || undefined,
      shippingAddresses: form.shippingAddresses
        .map((item) => ({
          label: item.label?.trim() || undefined,
          receiverName: item.receiverName?.trim() || form.name.trim(),
          phone: item.phone?.trim() || form.phone.trim(),
          address: item.address.trim(),
          isDefault: item.isDefault ?? false,
        }))
        .filter((item) => item.address),
    };

    try {
      if (editingCustomer) await apiClient.updateCustomer(editingCustomer.id, payload);
      else await apiClient.createCustomer(payload);
      setModalOpen(false);
      await Promise.all([fetchCustomers(), fetchGroups()]);
      if (editingCustomer && selectedCustomer?.id === editingCustomer.id) {
        await openDetail(editingCustomer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được khách hàng");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!alert.customer) return;
    setDeleting(true);
    setError("");
    try {
      await apiClient.deleteCustomer(alert.customer.id);
      setAlert(emptyAlert);
      setSelectedCustomer(null);
      await Promise.all([fetchCustomers(), fetchGroups()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được khách hàng");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setGroup("");
    setTag("");
    setMinSpent("");
    setPage(1);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
            Quản lý Khách hàng
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Theo dõi hồ sơ, địa chỉ giao hàng, lịch sử mua, chi tiêu, tags và phân nhóm khách hàng.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Thêm khách hàng
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon="groups" iconBgColor="bg-primary-fixed" label="Tổng khách hàng" value={formatNumber(total)} />
        <StatCard icon="workspace_premium" iconBgColor="bg-secondary-container" label="VIP trên trang này" value={String(stats.vip)} />
        <StatCard icon="shopping_bag" iconBgColor="bg-surface-container-high" label="Có đơn đang xử lý" value={String(stats.active)} />
        <StatCard icon="payments" iconBgColor="bg-tertiary-fixed" label="Chi tiêu trang này" value={formatCurrency(stats.totalSpent)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="grid gap-3 border-b border-outline-variant bg-surface-container-low/60 p-4 lg:grid-cols-[minmax(220px,1fr)_170px_170px_150px_auto]">
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
              placeholder="Tìm tên, SĐT, email"
              className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <select
            value={group}
            onChange={(event) => {
              setGroup(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">Tất cả nhóm</option>
            {GROUP_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
            {groups?.groups
              .filter((item) => !GROUP_OPTIONS.some((option) => option.value === item.name))
              .map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
          </select>
          <select
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">Tất cả tags</option>
            {groups?.tags.map((item) => (
              <option key={item.name} value={item.name}>{item.name} ({item.count})</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            value={minSpent}
            onChange={(event) => {
              setMinSpent(event.target.value);
              setPage(1);
            }}
            placeholder="Chi tiêu từ"
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          />
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
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase">Khách hàng</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Liên hệ</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Nhóm</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Tags</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Chi tiêu</th>
                <th className="px-5 py-4 text-center text-xs font-bold uppercase">Đơn hàng</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Đơn gần nhất</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-on-surface-variant">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-on-surface-variant">
                    Không có khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-primary/[0.04]">
                    <td className="px-5 py-4">
                      <Link href={`/customers/detail?id=${customer.id}`} className="flex items-center gap-3 text-left">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container font-bold text-primary">
                          {getInitials(customer.name)}
                        </span>
                        <span>
                          <span className="block font-semibold text-on-surface">{customer.name}</span>
                          <span className="block max-w-[220px] truncate text-xs text-on-surface-variant">{customer.address ?? "Chưa có địa chỉ"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p className="font-[family-name:var(--font-jetbrains)]">{customer.phone}</p>
                      <p className="text-on-surface-variant">{customer.email ?? "-"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${groupClass(customer.group)}`}>
                        {getGroupLabel(customer.group)}
                      </span>
                      {customer.suggestedGroup && customer.suggestedGroup !== customer.group ? (
                        <p className="mt-1 text-xs text-on-surface-variant">Gợi ý: {getGroupLabel(customer.suggestedGroup)}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {(customer.tags ?? []).slice(0, 3).map((item) => (
                          <span key={item} className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                            {item}
                          </span>
                        ))}
                        {(customer.tags ?? []).length > 3 && (
                          <span className="text-xs text-on-surface-variant">+{customer.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-primary">{formatCurrency(customer.totalSpent ?? 0)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {formatNumber(customer.totalOrders ?? customer._count?.orders ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{formatDate(customer.lastOrderAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <Link href={`/customers/detail?id=${customer.id}`} title="Chi tiết" className="rounded-lg p-2 text-primary hover:bg-primary-fixed">
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </Link>
                        <button type="button" onClick={() => openEditModal(customer)} title="Sửa" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        {(customer.totalOrders ?? customer._count?.orders ?? 0) === 0 && (
                          <button type="button" onClick={() => setAlert({ open: true, customer })} title="Xóa" className="rounded-lg p-2 text-error hover:bg-error-container">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-outline-variant bg-surface-container-low/40 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-on-surface-variant">
            Hiển thị <span className="font-bold text-on-surface">{customers.length}</span> trên{" "}
            <span className="font-bold text-on-surface">{formatNumber(total)}</span> khách hàng
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
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            {pages.map((item, index) =>
              item === "..." ? (
                <span key={`dots-${index}`} className="px-1 text-on-surface-variant">...</span>
              ) : (
                <button key={item} type="button" onClick={() => setPage(item as number)} className={`h-10 w-10 rounded-lg text-sm font-bold ${page === item ? "bg-primary text-on-primary" : "border border-outline-variant bg-white text-on-surface-variant"}`}>
                  {item}
                </button>
              )
            )}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
                <div>
                  <h3 className="text-xl font-bold text-on-surface">
                    {editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng"}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Tags dùng dấu phẩy để phân tách, ví dụ: ăn chay trường, khách Zalo, ưu tiên giao sáng.
                  </p>
                </div>
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 hover:bg-surface-container">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Tên khách hàng</span>
                  <input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Số điện thoại</span>
                  <input required value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Email</span>
                  <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Phân nhóm</span>
                  <select value={form.group} onChange={(event) => updateForm("group", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
                    {GROUP_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold">Địa chỉ mặc định</span>
                  <input value={form.address} onChange={(event) => updateForm("address", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold">Tags</span>
                  <input value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} placeholder="ăn chay trường, VIP Zalo" className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-semibold">Ghi chú khách hàng</span>
                  <textarea rows={4} value={form.note} onChange={(event) => updateForm("note", event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary" />
                </label>

                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between border-t border-outline-variant/40 pt-4">
                    <h4 className="font-bold text-on-surface">Địa chỉ giao hàng</h4>
                    <button type="button" onClick={addAddress} className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Thêm địa chỉ
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.shippingAddresses.map((item, index) => (
                      <div key={index} className="grid gap-3 rounded-lg border border-outline-variant p-4 md:grid-cols-[150px_1fr_150px_40px]">
                        <input value={item.label ?? ""} onChange={(event) => updateAddress(index, { label: event.target.value })} placeholder="Nhãn" className="h-10 rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                        <input value={item.address} onChange={(event) => updateAddress(index, { address: event.target.value })} placeholder="Địa chỉ giao hàng" className="h-10 rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                        <input value={item.phone ?? ""} onChange={(event) => updateAddress(index, { phone: event.target.value })} placeholder="SĐT nhận" className="h-10 rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                        <button type="button" onClick={() => removeAddress(index)} className="flex h-10 w-10 items-center justify-center rounded-lg text-error hover:bg-error-container">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    ))}
                    {form.shippingAddresses.length === 0 && (
                      <p className="rounded-lg border border-dashed border-outline-variant px-4 py-5 text-sm text-on-surface-variant">
                        Chưa có địa chỉ giao hàng phụ. Địa chỉ mặc định vẫn được dùng khi tạo đơn.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-outline-variant px-5 py-2.5 font-semibold text-on-surface-variant">Hủy</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
                  {saving ? "Đang lưu..." : "Lưu khách hàng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container font-bold text-primary">
                  {getInitials(selectedCustomer.name)}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-on-surface">{selectedCustomer.name}</h3>
                  <p className="text-sm text-on-surface-variant">{selectedCustomer.phone}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="rounded-lg p-2 hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5 p-6">
              {detailLoading ? (
                <div className="py-16 text-center text-on-surface-variant">Đang tải chi tiết...</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${groupClass(selectedCustomer.group)}`}>
                      {getGroupLabel(selectedCustomer.group)}
                    </span>
                    {selectedCustomer.tags?.map((item) => (
                      <span key={item} className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">
                        {item}
                      </span>
                    ))}
                    <button type="button" onClick={() => openEditModal(selectedCustomer)} className="ml-auto rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">
                      Sửa hồ sơ
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <StatCard icon="receipt_long" iconBgColor="bg-primary-fixed" label="Tổng đơn" value={formatNumber(customerStats?.totalOrders ?? selectedCustomer.totalOrders ?? 0)} />
                    <StatCard icon="payments" iconBgColor="bg-secondary-container" label="Tổng chi tiêu" value={formatCurrency(customerStats?.totalSpent ?? selectedCustomer.totalSpent ?? 0)} />
                    <StatCard icon="monitoring" iconBgColor="bg-surface-container-high" label="Giá trị TB" value={formatCurrency(customerStats?.averageOrderValue ?? selectedCustomer.averageOrderValue ?? 0)} />
                    <StatCard icon="tips_and_updates" iconBgColor="bg-tertiary-fixed" label="Gợi ý nhóm" value={getGroupLabel(customerStats?.suggestedGroup ?? selectedCustomer.suggestedGroup)} />
                  </div>

                  <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-outline-variant p-4">
                      <h4 className="font-bold">Thông tin liên hệ</h4>
                      <div className="mt-3 space-y-2 text-sm">
                        <p><span className="text-on-surface-variant">Email:</span> {selectedCustomer.email ?? "-"}</p>
                        <p><span className="text-on-surface-variant">Địa chỉ:</span> {selectedCustomer.address ?? "-"}</p>
                        <p><span className="text-on-surface-variant">Ngày tạo:</span> {formatDate(selectedCustomer.createdAt)}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-outline-variant p-4">
                      <h4 className="font-bold">Ghi chú</h4>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
                        {selectedCustomer.note || "Chưa có ghi chú cho khách hàng này."}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-lg border border-outline-variant">
                    <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3 font-bold">Địa chỉ giao hàng</div>
                    <div className="divide-y divide-outline-variant">
                      {(selectedCustomer.shippingAddresses ?? []).length === 0 ? (
                        <p className="px-4 py-6 text-sm text-on-surface-variant">Chưa có địa chỉ giao hàng.</p>
                      ) : (
                        selectedCustomer.shippingAddresses?.map((address, index) => (
                          <div key={`${address.address}-${index}`} className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{address.label || `Địa chỉ ${index + 1}`}</p>
                              {address.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Mặc định</span>}
                            </div>
                            <p className="mt-1 text-on-surface-variant">{address.address}</p>
                            <p className="text-on-surface-variant">{address.receiverName ?? selectedCustomer.name} · {address.phone ?? selectedCustomer.phone}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-outline-variant">
                    <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3 font-bold">Lịch sử đơn hàng</div>
                    <div className="divide-y divide-outline-variant">
                      {customerOrders.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-on-surface-variant">Khách hàng chưa có đơn hàng.</p>
                      ) : (
                        customerOrders.map((order) => (
                          <div key={order.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto_auto] md:items-center">
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

                  <section className="rounded-lg border border-outline-variant">
                    <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3 font-bold">Sản phẩm mua nhiều</div>
                    <div className="divide-y divide-outline-variant">
                      {(customerStats?.topProducts ?? []).length === 0 ? (
                        <p className="px-4 py-6 text-sm text-on-surface-variant">Chưa có dữ liệu sản phẩm đã mua.</p>
                      ) : (
                        customerStats?.topProducts.map((item) => (
                          <div key={item.product.id} className="flex items-center justify-between px-4 py-3 text-sm">
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        state={alert}
        loading={deleting}
        onCancel={() => setAlert(emptyAlert)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
