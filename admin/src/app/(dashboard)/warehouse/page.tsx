"use client";

import { Suspense, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  Category,
  InventorySummary,
  PaginatedResponse,
  Product,
  InventoryActionLog,
  StockAudit,
  StockMovement,
  StockMovementType,
  StockTransfer,
  Supplier,
  Warehouse,
} from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/shared/stat-card";

type TabKey = "inventory" | "movements" | "suppliers";
type StockStatus = "all" | "in_stock" | "low_stock" | "out_of_stock";
type OperationKey = "audit" | "transfer" | "warehouse" | "logs";

const operationOptions: Array<{
  key: OperationKey;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    key: "audit",
    label: "Kiểm kho",
    icon: "fact_check",
    description: "Ghi nhận tồn thực tế",
  },
  {
    key: "transfer",
    label: "Chuyển kho",
    icon: "sync_alt",
    description: "Chuyển hàng giữa các kho",
  },
  {
    key: "warehouse",
    label: "Kho vật lý",
    icon: "warehouse",
    description: "Tạo và xem danh sách kho",
  },
  {
    key: "logs",
    label: "Nhật ký thao tác",
    icon: "history",
    description: "Theo dõi thay đổi kho",
  },
];

const movementLabels: Record<StockMovementType, string> = {
  IN: "Nhập kho",
  OUT: "Xuất kho",
  ADJUSTMENT: "Điều chỉnh",
};

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StockBadge({ product }: { product: Product }) {
  if (product.stock === 0) {
    return (
      <span className="inline-flex rounded-full bg-inverse-surface px-3 py-1 text-xs font-bold text-inverse-on-surface">
        Hết hàng
      </span>
    );
  }
  if (product.stock <= product.minStock) {
    return (
      <span className="inline-flex rounded-full bg-error-container px-3 py-1 text-xs font-bold text-on-error-container">
        Sắp hết
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
      An toàn
    </span>
  );
}

function MovementBadge({ type }: { type: StockMovementType }) {
  const className =
    type === "IN"
      ? "bg-secondary-container text-on-secondary-container"
      : type === "OUT"
        ? "bg-error-container text-on-error-container"
        : "bg-tertiary-fixed text-on-tertiary-fixed";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {movementLabels[type]}
    </span>
  );
}

function WarehousePageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("inventory");
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lookupProducts, setLookupProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [actionLogs, setActionLogs] = useState<InventoryActionLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus>("all");

  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementTotalPages, setMovementTotalPages] = useState(1);
  const [movementType, setMovementType] = useState<"" | StockMovementType>("");

  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [supplierTotalPages, setSupplierTotalPages] = useState(1);
  const [supplierSearch, setSupplierSearch] = useState("");

  const [movementOpen, setMovementOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [activeOperation, setActiveOperation] = useState<OperationKey | null>(null);
  const [auditProductId, setAuditProductId] = useState("");
  const [auditWarehouseId, setAuditWarehouseId] = useState("");
  const [auditCountedStock, setAuditCountedStock] = useState("");
  const [auditNote, setAuditNote] = useState("");
  const [transferForm, setTransferForm] = useState({
    productId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    quantity: "",
    reference: "",
    reason: "",
  });
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    code: "",
    address: "",
    note: "",
  });

  const [movementForm, setMovementForm] = useState({
    productId: "",
    supplierId: "",
    type: "IN" as StockMovementType,
    quantity: "",
    unitCost: "",
    reference: "",
    reason: "",
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    note: "",
    isActive: true,
  });

  const fetchSummary = useCallback(async () => {
    const res = (await apiClient.getInventorySummary()) as InventorySummary | null;
    if (res) setSummary(res);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: "stock",
        order: "asc",
      });
      if (search.trim()) params.set("search", search.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (stockStatus !== "all") params.set("stockStatus", stockStatus);

      const res = (await apiClient.getInventoryProducts(params.toString())) as
        | PaginatedResponse<Product>
        | null;
      if (res) {
        setProducts(res.data);
        setTotal(res.meta.total);
        setTotalPages(Math.max(1, res.meta.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tồn kho");
    } finally {
      setLoading(false);
    }
  }, [categoryId, limit, page, search, stockStatus]);

  const fetchMovements = useCallback(async () => {
    const params = new URLSearchParams({ page: String(movementPage), limit: "10" });
    if (movementType) params.set("type", movementType);
    const res = (await apiClient.getStockMovements(params.toString())) as
      | PaginatedResponse<StockMovement>
      | null;
    if (res) {
      setMovements(res.data);
      setMovementTotal(res.meta.total);
      setMovementTotalPages(Math.max(1, res.meta.totalPages));
    }
  }, [movementPage, movementType]);

  const fetchSuppliers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(supplierPage), limit: "10" });
    if (supplierSearch.trim()) params.set("search", supplierSearch.trim());
    const res = (await apiClient.getSuppliers(params.toString())) as
      | PaginatedResponse<Supplier>
      | null;
    if (res) {
      setSuppliers(res.data);
      setSupplierTotal(res.meta.total);
      setSupplierTotalPages(Math.max(1, res.meta.totalPages));
    }
  }, [supplierPage, supplierSearch]);

  const fetchLookups = useCallback(async () => {
    const [categoryRes, productRes, warehouseRes] = await Promise.all([
      apiClient.getCategories("page=1&limit=100&isActive=true"),
      apiClient.getProducts("page=1&limit=100&isActive=true&sort=name&order=asc"),
      apiClient.getWarehouses(),
    ]);
    const categoryData = categoryRes as PaginatedResponse<Category> | null;
    const productData = productRes as PaginatedResponse<Product> | null;
    const warehouseData = warehouseRes as Warehouse[] | null;
    if (categoryData) setCategories(categoryData.data);
    if (productData) setLookupProducts(productData.data);
    if (warehouseData) setWarehouses(warehouseData);
  }, []);

  const fetchAdvanced = useCallback(async () => {
    const [auditRes, transferRes, logRes] = await Promise.all([
      apiClient.getStockAudits("page=1&limit=6"),
      apiClient.getStockTransfers("page=1&limit=6"),
      apiClient.getInventoryActionLogs("page=1&limit=10"),
    ]);
    const auditData = auditRes as PaginatedResponse<StockAudit> | null;
    const transferData = transferRes as PaginatedResponse<StockTransfer> | null;
    const logData = logRes as PaginatedResponse<InventoryActionLog> | null;
    if (auditData) setAudits(auditData.data);
    if (transferData) setTransfers(transferData.data);
    if (logData) setActionLogs(logData.data);
  }, []);

  useEffect(() => {
    fetchSummary().catch(() => undefined);
    fetchLookups().catch(() => undefined);
    fetchAdvanced().catch(() => undefined);
  }, [fetchAdvanced, fetchLookups, fetchSummary]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchProducts, 200);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProducts]);

  useEffect(() => {
    fetchMovements().catch((err) => {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử kho");
    });
  }, [fetchMovements]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchSuppliers().catch((err) => {
        setError(err instanceof Error ? err.message : "Không tải được nhà cung cấp");
      });
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [fetchSuppliers]);

  const inventoryValueOnPage = useMemo(
    () => products.reduce((sum, product) => sum + product.stock * product.price, 0),
    [products]
  );

  const openMovement = (type: StockMovementType, productId = "") => {
    setMovementForm({
      productId,
      supplierId: "",
      type,
      quantity: "",
      unitCost: "",
      reference: "",
      reason: "",
    });
    setError("");
    setMovementOpen(true);
  };

  const openSupplier = (supplier?: Supplier) => {
    setEditingSupplier(supplier ?? null);
    setSupplierForm(
      supplier
        ? {
            name: supplier.name,
            contactName: supplier.contactName || "",
            phone: supplier.phone || "",
            email: supplier.email || "",
            address: supplier.address || "",
            note: supplier.note || "",
            isActive: supplier.isActive,
          }
        : {
            name: "",
            contactName: "",
            phone: "",
            email: "",
            address: "",
            note: "",
            isActive: true,
          }
    );
    setError("");
    setSupplierOpen(true);
  };

  const saveMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.createStockMovement({
        productId: movementForm.productId,
        supplierId: movementForm.supplierId || undefined,
        type: movementForm.type,
        quantity: Number(movementForm.quantity || 0),
        unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined,
        reference: movementForm.reference.trim() || undefined,
        reason: movementForm.reason.trim() || undefined,
      });
      setMovementOpen(false);
      await Promise.all([fetchSummary(), fetchProducts(), fetchMovements(), fetchLookups()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được phiếu kho");
    } finally {
      setSaving(false);
    }
  };

  const saveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: supplierForm.name.trim(),
      contactName: supplierForm.contactName.trim() || undefined,
      phone: supplierForm.phone.trim() || undefined,
      email: supplierForm.email.trim() || undefined,
      address: supplierForm.address.trim() || undefined,
      note: supplierForm.note.trim() || undefined,
      isActive: supplierForm.isActive,
    };
    try {
      if (editingSupplier) await apiClient.updateSupplier(editingSupplier.id, payload);
      else await apiClient.createSupplier(payload);
      setSupplierOpen(false);
      await Promise.all([fetchSummary(), fetchSuppliers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được nhà cung cấp");
    } finally {
      setSaving(false);
    }
  };

  const archiveSupplier = async (supplier: Supplier) => {
    setSaving(true);
    setError("");
    try {
      await apiClient.deleteSupplier(supplier.id);
      await Promise.all([fetchSummary(), fetchSuppliers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không ngừng nhà cung cấp được");
    } finally {
      setSaving(false);
    }
  };

  const scrollToOperation = (key: OperationKey) => {
    setActiveOperation(key);
  };

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "suppliers") {
      setActiveTab("suppliers");
      return;
    }
    if (view === "movements") {
      setActiveTab("movements");
      return;
    }
    if (view === "operations") {
      setActiveTab("inventory");
      return;
    }
    if (view === "inventory") {
      setActiveTab("inventory");
    }
  }, [searchParams]);

  const saveQuickAdjustment = () => {
    setMovementForm({
      productId: "",
      supplierId: "",
      type: "ADJUSTMENT",
      quantity: "",
      unitCost: "",
      reference: "",
      reason: "Điều chỉnh tồn thủ công",
    });
    setMovementOpen(true);
  };

  const saveAudit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.createStockAudit({
        warehouseId: auditWarehouseId || undefined,
        note: auditNote.trim() || undefined,
        items: [
          {
            productId: auditProductId,
            countedStock: Number(auditCountedStock || 0),
            note: auditNote.trim() || undefined,
          },
        ],
      });
      setAuditProductId("");
      setAuditWarehouseId("");
      setAuditCountedStock("");
      setAuditNote("");
      await Promise.all([fetchSummary(), fetchProducts(), fetchMovements(), fetchAdvanced()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được phiếu kiểm kho");
    } finally {
      setSaving(false);
    }
  };

  const saveTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.createStockTransfer({
        productId: transferForm.productId,
        fromWarehouseId: transferForm.fromWarehouseId,
        toWarehouseId: transferForm.toWarehouseId,
        quantity: Number(transferForm.quantity || 0),
        reference: transferForm.reference.trim() || undefined,
        reason: transferForm.reason.trim() || undefined,
      });
      setTransferForm({
        productId: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        quantity: "",
        reference: "",
        reason: "",
      });
      await Promise.all([fetchAdvanced(), fetchLookups()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chuyển kho được");
    } finally {
      setSaving(false);
    }
  };

  const saveWarehouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.createWarehouse({
        name: warehouseForm.name.trim(),
        code: warehouseForm.code.trim().toUpperCase(),
        address: warehouseForm.address.trim() || undefined,
        note: warehouseForm.note.trim() || undefined,
      });
      setWarehouseForm({ name: "", code: "", address: "", note: "" });
      await Promise.all([fetchSummary(), fetchLookups(), fetchAdvanced()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được kho");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] font-semibold leading-10 text-on-surface">
            Quản lý Kho hàng
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Theo dõi tồn kho, nhập kho, xuất kho, nhà cung cấp và cảnh báo sắp hết hàng.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openMovement("OUT")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-5 py-2.5 text-sm font-semibold text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Xuất kho
          </button>
          <button
            type="button"
            onClick={() => openMovement("IN")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nhập kho mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon="payments"
          iconBgColor="bg-primary-fixed"
          iconTextColor="text-on-primary-fixed"
          label="Giá trị tồn kho"
          value={formatCurrency(summary?.totalValue ?? 0)}
          subtitle={`${formatNumber(summary?.totalStock ?? 0)} đơn vị đang tồn`}
        />
        <StatCard
          icon="inventory_2"
          iconBgColor="bg-secondary-container"
          iconTextColor="text-on-secondary-container"
          label="Sản phẩm trong kho"
          value={formatNumber(summary?.totalProducts ?? 0)}
          subtitle={`Trang này: ${formatCurrency(inventoryValueOnPage)}`}
        />
        <StatCard
          icon="warning"
          iconBgColor="bg-error-container"
          iconTextColor="text-on-error-container"
          label="Cảnh báo sắp hết"
          value={formatNumber(summary?.lowStockCount ?? 0)}
          subtitle={`${formatNumber(summary?.outOfStockCount ?? 0)} sản phẩm hết hàng`}
          variant="error"
        />
        <StatCard
          icon="local_shipping"
          iconBgColor="bg-tertiary-fixed"
          iconTextColor="text-on-tertiary-fixed"
          label="Nhà cung cấp"
          value={formatNumber(summary?.supplierCount ?? 0)}
          subtitle={`${formatNumber(movementTotal)} phiếu kho`}
        />
      </div>

      <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Nghiệp vụ kho</h3>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Chọn nhanh thao tác cần xử lý, không cần kéo xuống cuối trang.
            </p>
          </div>
          {/* <label className="relative block w-full lg:w-80">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              inventory
            </span>
            <select
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value as OperationKey | "";
                if (value) {
                  scrollToOperation(value);
                  event.currentTarget.value = "";
                }
              }}
              className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-10 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Chọn nghiệp vụ kho</option>
              {operationOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              expand_more
            </span>
          </label> */}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {operationOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => scrollToOperation(option.key)}
              className="flex min-h-16 items-center gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low/60 px-3 py-2 text-left transition-all hover:border-primary/40 hover:bg-secondary-container/60 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[20px] text-primary">
                {option.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-on-surface">{option.label}</span>
                <span className="block truncate text-xs text-on-surface-variant">
                  {option.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-outline-variant/50 bg-surface-container-low/40 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ["inventory", "Tồn kho", "inventory_2"],
              ["movements", "Nhập / xuất kho", "swap_vert"],
              ["suppliers", "Nhà cung cấp", "local_shipping"],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as TabKey)}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all ${
                  activeTab === key
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-white text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>
          {activeTab === "suppliers" && (
            <button
              type="button"
              onClick={() => openSupplier()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary-container"
            >
              <span className="material-symbols-outlined text-[18px]">add_business</span>
              Thêm nhà cung cấp
            </button>
          )}
        </div>

        {activeTab === "inventory" && (
          <>
            <div className="grid gap-3 border-b border-outline-variant/50 p-4 lg:grid-cols-[minmax(220px,1fr)_190px_180px_auto]">
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
                  placeholder="Tìm theo tên hoặc SKU"
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={stockStatus}
                onChange={(event) => {
                  setStockStatus(event.target.value as StockStatus);
                  setPage(1);
                }}
                className="h-11 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="all">Tất cả tồn kho</option>
                <option value="in_stock">Còn hàng</option>
                <option value="low_stock">Sắp hết hàng</option>
                <option value="out_of_stock">Hết hàng</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryId("");
                  setStockStatus("all");
                  setPage(1);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                Xóa lọc
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Sản phẩm</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">SKU</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Danh mục</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase">Tồn kho</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase">Tối thiểu</th>
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
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-on-surface-variant">
                        Không có sản phẩm phù hợp.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="transition-colors hover:bg-primary/[0.04]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-surface">
                              {product.images?.[0] ? (
                                <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-on-surface-variant">inventory_2</span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-on-surface">{product.name}</p>
                              <p className="text-xs text-on-surface-variant">{product.unit}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">{product.sku}</td>
                        <td className="px-5 py-4 text-sm text-on-surface-variant">{product.category?.name || "Chưa phân loại"}</td>
                        <td className="px-5 py-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold text-on-surface">{formatNumber(product.stock)}</td>
                        <td className="px-5 py-4 text-right font-[family-name:var(--font-jetbrains)] text-sm text-on-surface-variant">{formatNumber(product.minStock)}</td>
                        <td className="px-5 py-4"><StockBadge product={product} /></td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openMovement("IN", product.id)} title="Nhập kho" className="rounded-lg p-2 text-primary transition-colors hover:bg-secondary-container">
                              <span className="material-symbols-outlined text-[20px]">add</span>
                            </button>
                            <button type="button" onClick={() => openMovement("OUT", product.id)} title="Xuất kho" className="rounded-lg p-2 text-error transition-colors hover:bg-error-container">
                              <span className="material-symbols-outlined text-[20px]">remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-low/40 p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-on-surface-variant">
                Hiển thị <span className="font-bold text-on-surface">{products.length}</span> trên{" "}
                <span className="font-bold text-on-surface">{formatNumber(total)}</span> sản phẩm
              </p>
              <div className="flex items-center gap-2">
                <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm">
                  <option value={10}>10 / trang</option>
                  <option value={25}>25 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40">
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="px-2 text-sm font-semibold text-on-surface">{page}/{totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40">
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "movements" && (
          <>
            <div className="flex flex-col gap-3 border-b border-outline-variant/50 p-4 md:flex-row md:items-center md:justify-between">
              <select value={movementType} onChange={(event) => { setMovementType(event.target.value as "" | StockMovementType); setMovementPage(1); }} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary md:w-56">
                <option value="">Tất cả phiếu kho</option>
                <option value="IN">Nhập kho</option>
                <option value="OUT">Xuất kho</option>
                <option value="ADJUSTMENT">Điều chỉnh</option>
              </select>
              <p className="text-sm text-on-surface-variant">Tổng <span className="font-bold text-on-surface">{formatNumber(movementTotal)}</span> phiếu kho</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Thời gian</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Sản phẩm</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Loại</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase">Số lượng</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase">Tồn sau</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Nhà cung cấp</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {movements.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-16 text-center text-on-surface-variant">Chưa có phiếu kho.</td></tr>
                  ) : movements.map((movement) => (
                    <tr key={movement.id} className="transition-colors hover:bg-primary/[0.04]">
                      <td className="px-5 py-4 font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">{formatDate(movement.createdAt)}</td>
                      <td className="px-5 py-4"><p className="font-semibold text-on-surface">{movement.product.name}</p><p className="font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">{movement.product.sku}</p></td>
                      <td className="px-5 py-4"><MovementBadge type={movement.type} /></td>
                      <td className="px-5 py-4 text-right font-[family-name:var(--font-jetbrains)] text-sm font-bold">{formatNumber(movement.quantity)}</td>
                      <td className="px-5 py-4 text-right font-[family-name:var(--font-jetbrains)] text-sm">{formatNumber(movement.afterStock)}</td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{movement.supplier?.name || "-"}</td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{movement.reason || movement.reference || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-outline-variant bg-surface-container-low/40 p-4">
              <button type="button" disabled={movementPage === 1} onClick={() => setMovementPage((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
              <span className="flex h-10 items-center px-2 text-sm font-semibold">{movementPage}/{movementTotalPages}</span>
              <button type="button" disabled={movementPage >= movementTotalPages} onClick={() => setMovementPage((current) => Math.min(movementTotalPages, current + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
            </div>
          </>
        )}

        {activeTab === "suppliers" && (
          <>
            <div className="border-b border-outline-variant/50 p-4">
              <label className="relative block max-w-md">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
                <input value={supplierSearch} onChange={(event) => { setSupplierSearch(event.target.value); setSupplierPage(1); }} placeholder="Tìm nhà cung cấp" className="h-11 w-full rounded-lg border border-outline-variant bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Nhà cung cấp</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Liên hệ</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Địa chỉ</th>
                    <th className="px-5 py-4 text-center text-xs font-bold uppercase">Phiếu kho</th>
                    <th className="px-5 py-4 text-xs font-bold uppercase">Trạng thái</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {suppliers.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-16 text-center text-on-surface-variant">Chưa có nhà cung cấp.</td></tr>
                  ) : suppliers.map((supplier) => (
                    <tr key={supplier.id} className="transition-colors hover:bg-primary/[0.04]">
                      <td className="px-5 py-4"><p className="font-semibold text-on-surface">{supplier.name}</p><p className="text-xs text-on-surface-variant">{supplier.note || "Không có ghi chú"}</p></td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant"><p>{supplier.contactName || "-"}</p><p>{supplier.phone || supplier.email || "-"}</p></td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{supplier.address || "-"}</td>
                      <td className="px-5 py-4 text-center"><span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{formatNumber(supplier._count?.stockMovements ?? 0)}</span></td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${supplier.isActive ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>{supplier.isActive ? "Đang hợp tác" : "Đã ngừng"}</span></td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => openSupplier(supplier)} title="Sửa" className="rounded-lg p-2 text-primary transition-colors hover:bg-primary-fixed"><span className="material-symbols-outlined text-[20px]">edit</span></button><button type="button" disabled={saving} onClick={() => archiveSupplier(supplier)} title="Ngừng hợp tác" className="rounded-lg p-2 text-error transition-colors hover:bg-error-container disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">archive</span></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-outline-variant bg-surface-container-low/40 p-4">
              <button type="button" disabled={supplierPage === 1} onClick={() => setSupplierPage((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
              <span className="flex h-10 items-center px-2 text-sm font-semibold">{supplierPage}/{supplierTotalPages} ({formatNumber(supplierTotal)})</span>
              <button type="button" disabled={supplierPage >= supplierTotalPages} onClick={() => setSupplierPage((current) => Math.min(supplierTotalPages, current + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
            </div>
          </>
        )}
      </div>

      <div className="hidden">
        <div className="space-y-6">
          <div
            id="warehouse-operation-audit"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-on-surface">Kiểm kho</h3>
                <p className="text-sm text-on-surface-variant">
                  Ghi nhận số lượng thực tế và tự tạo phiếu điều chỉnh nếu có chênh lệch.
                </p>
              </div>
              <span className="material-symbols-outlined text-primary">fact_check</span>
            </div>
            <form onSubmit={saveAudit} className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Sản phẩm</span>
                <select
                  required
                  value={auditProductId}
                  onChange={(event) => setAuditProductId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Chọn sản phẩm</option>
                  {lookupProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.sku}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Kho kiểm</span>
                <select
                  value={auditWarehouseId}
                  onChange={(event) => setAuditWarehouseId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Tổng kho</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Tồn thực tế</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={auditCountedStock}
                  onChange={(event) => setAuditCountedStock(event.target.value)}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Ghi chú</span>
                <input
                  value={auditNote}
                  onChange={(event) => setAuditNote(event.target.value)}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="flex flex-wrap justify-between gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={saveQuickAdjustment}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  Điều chỉnh tồn nhanh
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Lưu kiểm kho
                </button>
              </div>
            </form>
          </div>

          <div
            id="warehouse-operation-transfer"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-on-surface">Chuyển kho</h3>
                <p className="text-sm text-on-surface-variant">
                  Chuyển số lượng giữa các kho vật lý, không làm thay đổi tổng tồn sản phẩm.
                </p>
              </div>
              <span className="material-symbols-outlined text-primary">sync_alt</span>
            </div>
            <form onSubmit={saveTransfer} className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-on-surface-variant">Sản phẩm</span>
                <select
                  required
                  value={transferForm.productId}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, productId: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Chọn sản phẩm</option>
                  {lookupProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.sku}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Từ kho</span>
                <select
                  required
                  value={transferForm.fromWarehouseId}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      fromWarehouseId: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Chọn kho nguồn</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Đến kho</span>
                <select
                  required
                  value={transferForm.toWarehouseId}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, toWarehouseId: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Chọn kho nhận</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Số lượng</span>
                <input
                  required
                  type="number"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, quantity: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-on-surface-variant">Mã tham chiếu</span>
                <input
                  value={transferForm.reference}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, reference: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-on-surface-variant">Lý do chuyển</span>
                <input
                  value={transferForm.reason}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="flex justify-end md:col-span-2">
                <button
                  type="submit"
                  disabled={saving || warehouses.length < 2}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                  Tạo phiếu chuyển
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div
            id="warehouse-operation-warehouse"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
          >
            <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
              <h3 className="text-base font-semibold text-on-surface">Kho vật lý</h3>
              <p className="text-sm text-on-surface-variant">Tạo kho để dùng cho chuyển kho.</p>
            </div>
            <form onSubmit={saveWarehouse} className="grid gap-3 p-5 sm:grid-cols-2">
              <input
                required
                value={warehouseForm.name}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Tên kho"
                className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
              />
              <input
                required
                value={warehouseForm.code}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="Mã kho"
                className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm uppercase outline-none focus:border-primary"
              />
              <input
                value={warehouseForm.address}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="Địa chỉ"
                className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary sm:col-span-2"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary hover:bg-secondary-container disabled:opacity-50 sm:col-span-2"
              >
                <span className="material-symbols-outlined text-[18px]">warehouse</span>
                Thêm kho
              </button>
            </form>
            <div className="divide-y divide-outline-variant border-t border-outline-variant/50">
              {warehouses.length === 0 ? (
                <p className="px-5 py-4 text-sm text-on-surface-variant">Chưa có kho vật lý.</p>
              ) : (
                warehouses.slice(0, 5).map((warehouse) => (
                  <div key={warehouse.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-semibold text-on-surface">{warehouse.name}</p>
                      <p className="font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">
                        {warehouse.code}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                      {formatNumber(warehouse._count?.stocks ?? 0)} SKU
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            id="warehouse-operation-logs"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
          >
            <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
              <h3 className="text-base font-semibold text-on-surface">Nhật ký thao tác</h3>
              <p className="text-sm text-on-surface-variant">Các thay đổi quan trọng trong quản lý kho.</p>
            </div>
            <div className="divide-y divide-outline-variant">
              {actionLogs.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-on-surface-variant">
                  Chưa có nhật ký thao tác.
                </p>
              ) : (
                actionLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">
                        {log.action}
                      </span>
                      <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-on-surface-variant">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-on-surface">{log.message}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{log.entityType}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
            <div className="border-b border-outline-variant/50 bg-surface-container-low/40 px-5 py-4">
              <h3 className="text-base font-semibold text-on-surface">Phiếu gần đây</h3>
            </div>
            <div className="grid gap-0 divide-y divide-outline-variant">
              {[...audits, ...transfers].slice(0, 6).map((item) => (
                <div key={item.id} className="px-5 py-3">
                  {"auditCode" in item ? (
                    <>
                      <p className="font-semibold text-on-surface">{item.auditCode}</p>
                      <p className="text-xs text-on-surface-variant">
                        Kiểm kho · {item.items.length} dòng · {formatDate(item.createdAt)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-on-surface">{item.transferCode}</p>
                      <p className="text-xs text-on-surface-variant">
                        {item.fromWarehouse.name} → {item.toWarehouse.name} · {formatDate(item.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeOperation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-outline-variant/50 px-6 py-5">
              <div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-primary">
                    {operationOptions.find((item) => item.key === activeOperation)?.icon}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface">
                      {operationOptions.find((item) => item.key === activeOperation)?.label}
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      {operationOptions.find((item) => item.key === activeOperation)?.description}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOperation(null)}
                className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="custom-scrollbar overflow-y-auto p-6">
              {activeOperation === "audit" && (
                <form onSubmit={saveAudit} className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Sản phẩm</span>
                    <select
                      required
                      value={auditProductId}
                      onChange={(event) => setAuditProductId(event.target.value)}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Chọn sản phẩm</option>
                      {lookupProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {product.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Kho kiểm</span>
                    <select
                      value={auditWarehouseId}
                      onChange={(event) => setAuditWarehouseId(event.target.value)}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Tổng kho</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Tồn thực tế</span>
                    <input
                      required
                      type="number"
                      min="0"
                      value={auditCountedStock}
                      onChange={(event) => setAuditCountedStock(event.target.value)}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Ghi chú</span>
                    <input
                      value={auditNote}
                      onChange={(event) => setAuditNote(event.target.value)}
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex flex-wrap justify-between gap-3 md:col-span-2">
                    <button
                      type="button"
                      onClick={saveQuickAdjustment}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                      Điều chỉnh tồn nhanh
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Lưu kiểm kho
                    </button>
                  </div>
                </form>
              )}

              {activeOperation === "transfer" && (
                <form onSubmit={saveTransfer} className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-semibold text-on-surface-variant">Sản phẩm</span>
                    <select
                      required
                      value={transferForm.productId}
                      onChange={(event) =>
                        setTransferForm((current) => ({ ...current, productId: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Chọn sản phẩm</option>
                      {lookupProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {product.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Từ kho</span>
                    <select
                      required
                      value={transferForm.fromWarehouseId}
                      onChange={(event) =>
                        setTransferForm((current) => ({
                          ...current,
                          fromWarehouseId: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Chọn kho nguồn</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Đến kho</span>
                    <select
                      required
                      value={transferForm.toWarehouseId}
                      onChange={(event) =>
                        setTransferForm((current) => ({ ...current, toWarehouseId: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Chọn kho nhận</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Số lượng</span>
                    <input
                      required
                      type="number"
                      min="1"
                      value={transferForm.quantity}
                      onChange={(event) =>
                        setTransferForm((current) => ({ ...current, quantity: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-on-surface-variant">Mã tham chiếu</span>
                    <input
                      value={transferForm.reference}
                      onChange={(event) =>
                        setTransferForm((current) => ({ ...current, reference: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-semibold text-on-surface-variant">Lý do chuyển</span>
                    <input
                      value={transferForm.reason}
                      onChange={(event) =>
                        setTransferForm((current) => ({ ...current, reason: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex justify-end md:col-span-2">
                    <button
                      type="submit"
                      disabled={saving || warehouses.length < 2}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                      Tạo phiếu chuyển
                    </button>
                  </div>
                </form>
              )}

              {activeOperation === "warehouse" && (
                <div className="space-y-5">
                  <form onSubmit={saveWarehouse} className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={warehouseForm.name}
                      onChange={(event) =>
                        setWarehouseForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Tên kho"
                      className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                    <input
                      required
                      value={warehouseForm.code}
                      onChange={(event) =>
                        setWarehouseForm((current) => ({ ...current, code: event.target.value }))
                      }
                      placeholder="Mã kho"
                      className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm uppercase outline-none focus:border-primary"
                    />
                    <input
                      value={warehouseForm.address}
                      onChange={(event) =>
                        setWarehouseForm((current) => ({ ...current, address: event.target.value }))
                      }
                      placeholder="Địa chỉ"
                      className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary sm:col-span-2"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50 sm:col-span-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">warehouse</span>
                      Thêm kho
                    </button>
                  </form>
                  <div className="overflow-hidden rounded-lg border border-outline-variant">
                    {warehouses.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-on-surface-variant">Chưa có kho vật lý.</p>
                    ) : (
                      warehouses.map((warehouse) => (
                        <div key={warehouse.id} className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-3 last:border-b-0">
                          <div>
                            <p className="font-semibold text-on-surface">{warehouse.name}</p>
                            <p className="font-[family-name:var(--font-jetbrains)] text-xs text-on-surface-variant">
                              {warehouse.code}
                            </p>
                          </div>
                          <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                            {formatNumber(warehouse._count?.stocks ?? 0)} SKU
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeOperation === "logs" && (
                <div className="overflow-hidden rounded-lg border border-outline-variant">
                  {actionLogs.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-on-surface-variant">
                      Chưa có nhật ký thao tác.
                    </p>
                  ) : (
                    actionLogs.map((log) => (
                      <div key={log.id} className="border-b border-outline-variant px-5 py-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">
                            {log.action}
                          </span>
                          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-on-surface-variant">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-on-surface">{log.message}</p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">{log.entityType}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {movementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <form onSubmit={saveMovement}>
              <div className="flex items-center justify-between border-b border-outline-variant/50 px-6 py-5">
                <div><h3 className="text-lg font-semibold text-on-surface">Tạo phiếu kho</h3><p className="mt-0.5 text-sm text-on-surface-variant">Nhập kho, xuất kho hoặc điều chỉnh số lượng tồn thực tế.</p></div>
                <button type="button" onClick={() => setMovementOpen(false)} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined text-[20px]">close</span></button>
              </div>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Loại phiếu</span><select value={movementForm.type} onChange={(event) => setMovementForm((current) => ({ ...current, type: event.target.value as StockMovementType }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"><option value="IN">Nhập kho</option><option value="OUT">Xuất kho</option><option value="ADJUSTMENT">Điều chỉnh tồn</option></select></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Sản phẩm</span><select required value={movementForm.productId} onChange={(event) => setMovementForm((current) => ({ ...current, productId: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"><option value="">Chọn sản phẩm</option>{lookupProducts.map((product) => (<option key={product.id} value={product.id}>{product.name} - {product.sku}</option>))}</select></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">{movementForm.type === "ADJUSTMENT" ? "Tồn thực tế" : "Số lượng"}</span><input required type="number" min="0" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Nhà cung cấp</span><select value={movementForm.supplierId} onChange={(event) => setMovementForm((current) => ({ ...current, supplierId: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary"><option value="">Không chọn</option>{suppliers.filter((supplier) => supplier.isActive).map((supplier) => (<option key={supplier.id} value={supplier.id}>{supplier.name}</option>))}</select></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Đơn giá nhập</span><input type="number" min="0" value={movementForm.unitCost} onChange={(event) => setMovementForm((current) => ({ ...current, unitCost: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Mã tham chiếu</span><input value={movementForm.reference} onChange={(event) => setMovementForm((current) => ({ ...current, reference: event.target.value }))} placeholder="VD: PO-20260605-001" className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-semibold text-on-surface-variant">Ghi chú</span><textarea rows={3} value={movementForm.reason} onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))} className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-primary" /></label>
              </div>
              <div className="flex justify-end gap-3 border-t border-outline-variant/50 px-6 py-4"><button type="button" onClick={() => setMovementOpen(false)} className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu phiếu kho"}</button></div>
            </form>
          </div>
        </div>
      )}

      {supplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <form onSubmit={saveSupplier}>
              <div className="flex items-center justify-between border-b border-outline-variant/50 px-6 py-5"><div><h3 className="text-lg font-semibold text-on-surface">{editingSupplier ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</h3><p className="mt-0.5 text-sm text-on-surface-variant">Lưu thông tin liên hệ dùng khi tạo phiếu nhập kho.</p></div><button type="button" onClick={() => setSupplierOpen(false)} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined text-[20px]">close</span></button></div>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Tên nhà cung cấp</span><input required value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Người liên hệ</span><input value={supplierForm.contactName} onChange={(event) => setSupplierForm((current) => ({ ...current, contactName: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Số điện thoại</span><input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5"><span className="text-sm font-semibold text-on-surface-variant">Email</span><input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-semibold text-on-surface-variant">Địa chỉ</span><input value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-semibold text-on-surface-variant">Ghi chú</span><textarea rows={3} value={supplierForm.note} onChange={(event) => setSupplierForm((current) => ({ ...current, note: event.target.value }))} className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-primary" /></label>
                <label className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={supplierForm.isActive} onChange={(event) => setSupplierForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" /><span className="text-sm font-semibold text-on-surface-variant">Đang hợp tác</span></label>
              </div>
              <div className="flex justify-end gap-3 border-t border-outline-variant/50 px-6 py-4"><button type="button" onClick={() => setSupplierOpen(false)} className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu nhà cung cấp"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WarehousePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-on-surface-variant lg:p-8">
          Đang tải kho hàng...
        </div>
      }
    >
      <WarehousePageContent />
    </Suspense>
  );
}
