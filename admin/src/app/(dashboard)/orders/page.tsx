"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  Customer,
  Order,
  OrderInvoice,
  OrderReport,
  OrderStatus,
  PaginatedResponse,
  PaymentMethod,
  Product,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

type OrderFormItem = {
  productId: string;
  quantity: string;
};

type OrderForm = {
  customerId: string;
  shippingAddress: string;
  shippingPhone: string;
  paymentMethod: PaymentMethod;
  discount: string;
  note: string;
  items: OrderFormItem[];
};

type AlertState = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  action: "cancel" | "refund" | "delete" | null;
  order: Order | null;
};

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "COD", label: "COD" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "MOMO", label: "MoMo" },
  { value: "VNPAY", label: "VNPay" },
];

const STATUS_OPTIONS: Array<{ value: OrderStatus | ""; label: string }> = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PROCESSING", label: "Đang chuẩn bị" },
  { value: "SHIPPED", label: "Đang giao" },
  { value: "DELIVERED", label: "Đã giao" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "REFUNDING", label: "Đang hoàn" },
  { value: "REFUNDED", label: "Đã hoàn" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: "REFUNDING",
  REFUNDING: "REFUNDED",
};

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Xác nhận",
  CONFIRMED: "Chuẩn bị",
  PROCESSING: "Giao hàng",
  SHIPPED: "Đã giao",
  DELIVERED: "Bắt đầu hoàn",
  REFUNDING: "Hoàn tất",
};

const emptyForm: OrderForm = {
  customerId: "",
  shippingAddress: "",
  shippingPhone: "",
  paymentMethod: "COD",
  discount: "0",
  note: "",
  items: [{ productId: "", quantity: "1" }],
};

const emptyAlert: AlertState = {
  open: false,
  title: "",
  description: "",
  confirmText: "",
  action: null,
  order: null,
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

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPaymentLabel(value: PaymentMethod) {
  return PAYMENT_METHODS.find((item) => item.value === value)?.label ?? value;
}

function canEdit(order: Order) {
  return ["PENDING", "CONFIRMED", "PROCESSING", "CANCELLED"].includes(order.status);
}

function canCancel(order: Order) {
  return ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status);
}

function canDelete(order: Order) {
  return ["PENDING", "CANCELLED"].includes(order.status);
}

function canRefund(order: Order) {
  return ["DELIVERED", "REFUNDING"].includes(order.status);
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
  if (!state.open || !state.order) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex gap-4 border-b border-outline-variant px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-error-container text-on-error-container">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">{state.title}</h3>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              {state.description}
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
            {loading ? "Đang xử lý..." : state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [report, setReport] = useState<OrderReport | null>(null);
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [alert, setAlert] = useState<AlertState>(emptyAlert);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort: "createdAt",
      order: "desc",
    });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  }, [dateFrom, dateTo, limit, page, paymentMethod, search, status]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = (await apiClient.getOrders(
        buildParams().toString()
      )) as PaginatedResponse<Order> | null;
      if (res) {
        setOrders(res.data);
        setTotal(res.meta.total);
        setTotalPages(Math.max(1, res.meta.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được đơn hàng");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchLookups = useCallback(async () => {
    const [customerRes, productRes] = await Promise.all([
      apiClient.getCustomers("page=1&limit=100"),
      apiClient.getProducts("page=1&limit=100&isActive=true"),
    ]);
    const customerPage = customerRes as PaginatedResponse<Customer> | null;
    const productPage = productRes as PaginatedResponse<Product> | null;
    if (customerPage) setCustomers(customerPage.data);
    if (productPage) setProducts(productPage.data);
  }, []);

  useEffect(() => {
    fetchLookups().catch(() => undefined);
  }, [fetchLookups]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchOrders();
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [fetchOrders]);

  const stats = useMemo(() => {
    const processing = orders.filter((order) =>
      ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status)
    ).length;
    const shipped = orders.filter((order) => order.status === "SHIPPED").length;
    const revenue = orders
      .filter((order) => order.status === "DELIVERED")
      .reduce((sum, order) => sum + order.finalAmount, 0);
    return { processing, shipped, revenue };
  }, [orders]);

  const productMap = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const formTotal = useMemo(() => {
    const totalAmount = form.items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      const price = product ? product.salePrice ?? product.price : 0;
      return sum + price * Number(item.quantity || 0);
    }, 0);
    const discount = Math.min(Number(form.discount || 0), totalAmount);
    return { totalAmount, discount, finalAmount: totalAmount - discount };
  }, [form.discount, form.items, productMap]);

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

  const updateForm = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (index: number, value: Partial<OrderFormItem>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...value } : item
      ),
    }));
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, { productId: "", quantity: "1" }],
    }));
  };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setForm({
      customerId: order.customerId,
      shippingAddress: order.shippingAddress,
      shippingPhone: order.shippingPhone,
      paymentMethod: order.paymentMethod,
      discount: String(order.discount ?? 0),
      note: order.note ?? "",
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
      })),
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      customerId: form.customerId,
      shippingAddress: form.shippingAddress.trim(),
      shippingPhone: form.shippingPhone.trim(),
      paymentMethod: form.paymentMethod,
      discount: Number(form.discount || 0),
      note: form.note.trim() || undefined,
      items: form.items
        .filter((item) => item.productId && Number(item.quantity) > 0)
        .map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
    };

    try {
      if (editingOrder) await apiClient.updateOrder(editingOrder.id, payload);
      else await apiClient.createOrder(payload);
      setModalOpen(false);
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được đơn hàng");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setActionLoading(true);
    setError("");
    try {
      await apiClient.updateOrderStatus(order.id, next);
      await fetchOrders();
      if (selectedOrder?.id === order.id) {
        const fresh = (await apiClient.getOrder(order.id)) as Order | null;
        setSelectedOrder(fresh);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái");
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (order: Order, action: AlertState["action"]) => {
    if (action === "cancel") {
      setAlert({
        open: true,
        title: "Hủy đơn hàng",
        description: `Hủy đơn ${order.orderCode} và hoàn lại tồn kho cho các sản phẩm trong đơn.`,
        confirmText: "Hủy đơn",
        action,
        order,
      });
    } else if (action === "refund") {
      setAlert({
        open: true,
        title: "Hoàn hàng",
        description: `Hoàn đơn ${order.orderCode}; hệ thống sẽ trả hàng về kho và chuyển trạng thái sang đã hoàn.`,
        confirmText: "Hoàn hàng",
        action,
        order,
      });
    } else if (action === "delete") {
      setAlert({
        open: true,
        title: "Xóa đơn hàng",
        description: `Xóa đơn ${order.orderCode}. Chỉ nên dùng cho đơn nháp hoặc đơn đã hủy.`,
        confirmText: "Xóa đơn",
        action,
        order,
      });
    }
  };

  const confirmAction = async () => {
    if (!alert.order || !alert.action) return;
    setActionLoading(true);
    setError("");
    try {
      if (alert.action === "cancel") await apiClient.cancelOrder(alert.order.id);
      if (alert.action === "refund") await apiClient.refundOrder(alert.order.id);
      if (alert.action === "delete") await apiClient.deleteOrder(alert.order.id);
      setAlert(emptyAlert);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được thao tác");
    } finally {
      setActionLoading(false);
    }
  };

  const openInvoice = async (order: Order) => {
    setActionLoading(true);
    setError("");
    try {
      const data = (await apiClient.getOrderInvoice(order.id)) as OrderInvoice | null;
      if (data) {
        setInvoice(data);
        setInvoiceOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được phiếu bán hàng");
    } finally {
      setActionLoading(false);
    }
  };

  const openReport = async () => {
    setActionLoading(true);
    setError("");
    try {
      const params = buildParams();
      params.delete("page");
      params.delete("limit");
      params.delete("sort");
      params.delete("order");
      const data = (await apiClient.getOrderReport(params.toString())) as OrderReport | null;
      if (data) {
        setReport(data);
        setReportOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được báo cáo");
    } finally {
      setActionLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentMethod("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
            Quản lý Đơn hàng
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Tạo đơn, cập nhật trạng thái, hủy/hoàn hàng, in phiếu bán hàng và xem báo cáo.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openReport}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-5 py-2.5 text-sm font-semibold text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            Báo cáo
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Tạo đơn hàng
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon="receipt_long" iconBgColor="bg-primary-fixed" label="Tổng đơn" value={formatNumber(total)} />
        <StatCard icon="pending_actions" iconBgColor="bg-secondary-container" label="Đang xử lý trang này" value={String(stats.processing)} />
        <StatCard icon="local_shipping" iconBgColor="bg-surface-container-high" label="Đang giao trang này" value={String(stats.shipped)} />
        <StatCard icon="payments" iconBgColor="bg-tertiary-fixed" label="Doanh thu trang này" value={formatCurrency(stats.revenue)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="grid gap-3 border-b border-outline-variant bg-surface-container-low/60 p-4 lg:grid-cols-[minmax(220px,1fr)_180px_160px_150px_150px_auto]">
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
              placeholder="Tìm mã đơn, khách hàng, số điện thoại"
              className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value as PaymentMethod | "");
              setPage(1);
            }}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">Tất cả thanh toán</option>
            {PAYMENT_METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
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
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
              <tr>
                <th className="px-5 py-4 text-xs font-bold uppercase">Mã đơn</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Khách hàng</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Ngày đặt</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Giá trị</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Thanh toán</th>
                <th className="px-5 py-4 text-xs font-bold uppercase">Trạng thái</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-on-surface-variant">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-on-surface-variant">
                    Không có đơn hàng phù hợp.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-primary/[0.04]">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-primary hover:underline"
                      >
                        {order.orderCode}
                      </button>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {order.items.length} dòng hàng
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-on-surface">{order.customer?.name ?? "Khách hàng"}</p>
                      <p className="text-xs text-on-surface-variant">{order.customer?.phone ?? order.shippingPhone}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{formatDate(order.createdAt)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-primary">{formatCurrency(order.finalAmount)}</td>
                    <td className="px-5 py-4 text-sm">{getPaymentLabel(order.paymentMethod)}</td>
                    <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setSelectedOrder(order)} title="Chi tiết" className="rounded-lg p-2 text-primary hover:bg-primary-fixed">
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </button>
                        {canEdit(order) && (
                          <button type="button" onClick={() => openEditModal(order)} title="Sửa" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                        )}
                        {NEXT_STATUS[order.status] && (
                          <button type="button" onClick={() => handleStatus(order)} disabled={actionLoading} title={NEXT_STATUS_LABEL[order.status]} className="rounded-lg p-2 text-on-surface-variant hover:bg-secondary-container disabled:opacity-50">
                            <span className="material-symbols-outlined text-[20px]">published_with_changes</span>
                          </button>
                        )}
                        <button type="button" onClick={() => openInvoice(order)} title="Phiếu bán hàng" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px]">receipt</span>
                        </button>
                        {canCancel(order) && (
                          <button type="button" onClick={() => openActionDialog(order, "cancel")} title="Hủy đơn" className="rounded-lg p-2 text-error hover:bg-error-container">
                            <span className="material-symbols-outlined text-[20px]">cancel</span>
                          </button>
                        )}
                        {canRefund(order) && (
                          <button type="button" onClick={() => openActionDialog(order, "refund")} title="Hoàn hàng" className="rounded-lg p-2 text-error hover:bg-error-container">
                            <span className="material-symbols-outlined text-[20px]">assignment_return</span>
                          </button>
                        )}
                        {canDelete(order) && (
                          <button type="button" onClick={() => openActionDialog(order, "delete")} title="Xóa" className="rounded-lg p-2 text-error hover:bg-error-container">
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
            Hiển thị <span className="font-bold text-on-surface">{orders.length}</span> trên{" "}
            <span className="font-bold text-on-surface">{formatNumber(total)}</span> đơn hàng
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
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
                <div>
                  <h3 className="text-xl font-bold text-on-surface">
                    {editingOrder ? "Sửa đơn hàng" : "Tạo đơn hàng"}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Tạo đơn sẽ trừ kho ngay; hủy, xóa hoặc hoàn hàng sẽ trả kho.
                  </p>
                </div>
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 hover:bg-surface-container">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="grid gap-5 p-6 lg:grid-cols-[1fr_340px]">
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold">Khách hàng</span>
                      <select required value={form.customerId} onChange={(event) => updateForm("customerId", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
                        <option value="">Chọn khách hàng</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} - {customer.phone}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold">SĐT nhận hàng</span>
                      <input required value={form.shippingPhone} onChange={(event) => updateForm("shippingPhone", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-sm font-semibold">Địa chỉ giao hàng</span>
                      <input required value={form.shippingAddress} onChange={(event) => updateForm("shippingAddress", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold">Thanh toán</span>
                      <select value={form.paymentMethod} onChange={(event) => updateForm("paymentMethod", event.target.value as PaymentMethod)} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
                        {PAYMENT_METHODS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold">Giảm giá</span>
                      <input type="number" min="0" value={form.discount} onChange={(event) => updateForm("discount", event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-sm font-semibold">Ghi chú</span>
                      <textarea rows={3} value={form.note} onChange={(event) => updateForm("note", event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary" />
                    </label>
                  </div>

                  <div className="rounded-lg border border-outline-variant">
                    <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3">
                      <h4 className="font-bold text-on-surface">Sản phẩm</h4>
                      <button type="button" onClick={addItem} className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Thêm dòng
                      </button>
                    </div>
                    <div className="divide-y divide-outline-variant">
                      {form.items.map((item, index) => {
                        const product = productMap.get(item.productId);
                        const price = product ? product.salePrice ?? product.price : 0;
                        return (
                          <div key={index} className="grid gap-3 p-4 md:grid-cols-[1fr_110px_130px_40px] md:items-end">
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold text-on-surface-variant">Sản phẩm</span>
                              <select required value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
                                <option value="">Chọn sản phẩm</option>
                                {products.map((productItem) => (
                                  <option key={productItem.id} value={productItem.id}>
                                    {productItem.name} - tồn {productItem.stock} {productItem.unit}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="space-y-1.5">
                              <span className="text-xs font-semibold text-on-surface-variant">Số lượng</span>
                              <input required type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} className="h-11 w-full rounded-lg border border-outline-variant px-3 text-sm outline-none focus:border-primary" />
                            </label>
                            <div className="text-sm">
                              <p className="text-on-surface-variant">Thành tiền</p>
                              <p className="font-bold text-primary">{formatCurrency(price * Number(item.quantity || 0))}</p>
                            </div>
                            <button type="button" onClick={() => removeItem(index)} className="flex h-10 w-10 items-center justify-center rounded-lg text-error hover:bg-error-container">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-low p-5">
                  <h4 className="font-bold text-on-surface">Tóm tắt đơn</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Tạm tính</span><strong>{formatCurrency(formTotal.totalAmount)}</strong></div>
                    <div className="flex justify-between"><span>Giảm giá</span><strong>{formatCurrency(formTotal.discount)}</strong></div>
                    <div className="border-t border-outline-variant pt-3">
                      <div className="flex justify-between text-lg text-primary"><span className="font-bold">Thành tiền</span><strong>{formatCurrency(formTotal.finalAmount)}</strong></div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 text-xs leading-5 text-on-surface-variant">
                    Khi lưu đơn, hệ thống kiểm tra tồn kho từng sản phẩm và ghi phiếu xuất kho tự động.
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-outline-variant px-5 py-2.5 font-semibold text-on-surface-variant">Hủy</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
                  {saving ? "Đang lưu..." : "Lưu đơn hàng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant bg-white px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-on-surface">{selectedOrder.orderCode}</h3>
                <p className="text-sm text-on-surface-variant">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selectedOrder.status} />
                {NEXT_STATUS[selectedOrder.status] && (
                  <button type="button" onClick={() => handleStatus(selectedOrder)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                    {NEXT_STATUS_LABEL[selectedOrder.status]}
                  </button>
                )}
                {canEdit(selectedOrder) && <button type="button" onClick={() => openEditModal(selectedOrder)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Sửa</button>}
                <button type="button" onClick={() => openInvoice(selectedOrder)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Phiếu bán hàng</button>
              </div>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-outline-variant p-4">
                  <h4 className="font-bold">Khách hàng</h4>
                  <p className="mt-2 font-semibold">{selectedOrder.customer?.name}</p>
                  <p className="text-sm text-on-surface-variant">{selectedOrder.customer?.phone}</p>
                  <p className="mt-3 text-sm text-on-surface-variant">{selectedOrder.shippingAddress}</p>
                </div>
                <div className="rounded-lg border border-outline-variant p-4">
                  <h4 className="font-bold">Thanh toán</h4>
                  <p className="mt-2 text-sm">{getPaymentLabel(selectedOrder.paymentMethod)}</p>
                  <p className="text-sm text-on-surface-variant">Đã thanh toán: {formatDate(selectedOrder.paidAt)}</p>
                  <p className="text-sm text-on-surface-variant">Giao hàng: {formatDate(selectedOrder.shippedAt)}</p>
                  <p className="text-sm text-on-surface-variant">Hoàn thành: {formatDate(selectedOrder.deliveredAt)}</p>
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant">
                <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3 font-bold">Dòng hàng</div>
                <div className="divide-y divide-outline-variant">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                      <div>
                        <p className="font-semibold">{item.product?.name}</p>
                        <p className="text-xs text-on-surface-variant">{item.product?.sku}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{formatNumber(item.quantity)} x {formatCurrency(item.unitPrice)}</p>
                        <p className="font-bold text-primary">{formatCurrency(item.quantity * item.unitPrice)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ml-auto w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><strong>{formatCurrency(selectedOrder.totalAmount)}</strong></div>
                <div className="flex justify-between"><span>Giảm giá</span><strong>{formatCurrency(selectedOrder.discount)}</strong></div>
                <div className="flex justify-between border-t border-outline-variant pt-3 text-lg text-primary"><span>Thành tiền</span><strong>{formatCurrency(selectedOrder.finalAmount)}</strong></div>
              </section>
            </div>
          </div>
        </div>
      )}

      {invoiceOpen && invoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <h3 className="text-xl font-bold">Phiếu bán hàng {invoice.invoiceNo}</h3>
              <button type="button" onClick={() => setInvoiceOpen(false)} className="rounded-lg p-2 hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-on-surface-variant">Cửa hàng</p>
                  <p className="font-bold">{invoice.seller.name}</p>
                  <p className="text-sm">{invoice.seller.phone}</p>
                  <p className="text-sm">{invoice.seller.address}</p>
                </div>
                <div className="md:text-right">
                  <p className="text-sm text-on-surface-variant">Ngày lập</p>
                  <p className="font-semibold">{formatDate(invoice.issuedAt)}</p>
                  <p className="text-sm text-on-surface-variant">Đơn hàng: {invoice.order.orderCode}</p>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-outline-variant text-on-surface-variant">
                  <tr>
                    <th className="py-2">Sản phẩm</th>
                    <th className="py-2 text-right">SL</th>
                    <th className="py-2 text-right">Đơn giá</th>
                    <th className="py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {invoice.order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">{item.product?.name}</td>
                      <td className="py-3 text-right">{formatNumber(item.quantity)}</td>
                      <td className="py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ml-auto w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><strong>{formatCurrency(invoice.totals.totalAmount)}</strong></div>
                <div className="flex justify-between"><span>Giảm giá</span><strong>{formatCurrency(invoice.totals.discount)}</strong></div>
                <div className="flex justify-between border-t border-outline-variant pt-3 text-lg text-primary"><span>Thành tiền</span><strong>{formatCurrency(invoice.totals.finalAmount)}</strong></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
              <button type="button" onClick={() => window.print()} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary">In phiếu</button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && report && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <h3 className="text-xl font-bold">Báo cáo đơn hàng</h3>
              <button type="button" onClick={() => setReportOpen(false)} className="rounded-lg p-2 hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard icon="receipt_long" iconBgColor="bg-primary-fixed" label="Tổng đơn" value={formatNumber(report.totalOrders)} />
                <StatCard icon="payments" iconBgColor="bg-secondary-container" label="Doanh thu" value={formatCurrency(report.revenue)} />
                <StatCard icon="hourglass_top" iconBgColor="bg-surface-container-high" label="Giá trị chờ xử lý" value={formatCurrency(report.pendingValue)} />
                <StatCard icon="monitoring" iconBgColor="bg-tertiary-fixed" label="Giá trị TB" value={formatCurrency(report.averageOrderValue)} />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded-lg border border-outline-variant">
                  <div className="border-b border-outline-variant px-4 py-3 font-bold">Theo trạng thái</div>
                  <div className="divide-y divide-outline-variant">
                    {report.byStatus.map((item) => (
                      <div key={item.status} className="flex items-center justify-between px-4 py-3 text-sm">
                        <StatusBadge status={item.status} />
                        <span className="font-semibold">{formatNumber(item._count._all)} đơn</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-lg border border-outline-variant">
                  <div className="border-b border-outline-variant px-4 py-3 font-bold">Sản phẩm bán nhiều</div>
                  <div className="divide-y divide-outline-variant">
                    {report.topProducts.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold">{item.product.name ?? item.product.id}</p>
                          <p className="text-xs text-on-surface-variant">{item.product.sku}</p>
                        </div>
                        <span className="font-bold text-primary">{formatNumber(item.quantity)}</span>
                      </div>
                    ))}
                    {report.topProducts.length === 0 && <p className="px-4 py-6 text-sm text-on-surface-variant">Chưa có dữ liệu.</p>}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        state={alert}
        loading={actionLoading}
        onCancel={() => setAlert(emptyAlert)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
