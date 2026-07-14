import type { ImportReport } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...((options?.headers as Record<string, string>) ?? {}),
    };
    // GET/DELETE không có body không cần Content-Type. Tránh tạo preflight CORS
    // không cần thiết cho các request chỉ đọc dữ liệu.
    if (options?.body !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (res.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message || `Lỗi API ${res.status}`
      );
    }

    const response = (await res.json()) as unknown;

    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      !("meta" in response)
    ) {
      return (response as { data: T }).data;
    }

    return response as T;
  }

  private async fetchForm<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T | null> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message || `Lỗi API ${res.status}`
      );
    }

    const response = (await res.json()) as unknown;

    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      !("meta" in response)
    ) {
      return (response as { data: T }).data;
    }

    return response as T;
  }

  // ── Auth ──
  // Login cần xử lý 401 riêng: throw error thay vì redirect về /login
  async login(username: string, password: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password }),
    });

    if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message ||
          "Sai tên đăng nhập hoặc mật khẩu"
      );
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message || `Lỗi API ${res.status}`
      );
    }

    const response = (await res.json()) as unknown;

    // Unwrap { data: ... } nếu có (TransformInterceptor bên backend)
    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      !("meta" in response)
    ) {
      return (response as { data: unknown }).data;
    }

    return response;
  }

  refreshToken(refreshToken: string) {
    return this.fetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  // ── Products ──
  getProducts(params?: string) {
    return this.fetch(`/products${params ? `?${params}` : ""}`);
  }

  getProduct(id: string) {
    return this.fetch(`/products/${id}`);
  }

  createProduct(data: unknown) {
    return this.fetch("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateProduct(id: string, data: unknown) {
    return this.fetch(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteProduct(id: string) {
    return this.fetch(`/products/${id}`, { method: "DELETE" });
  }

  uploadProductImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.fetchForm<{
      url: string;
      publicId?: string;
      width?: number;
      height?: number;
      format?: string;
    }>("/products/upload-image", formData);
  }

  // ── Import Excel ──
  // Tải file mẫu .xlsx (nhị phân) — fetch riêng vì fetch/fetchForm đang parse JSON.
  async downloadImportTemplate(): Promise<Blob> {
    const token = this.getToken();
    const res = await fetch(`${API_URL}/products/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      throw new Error("Phiên đăng nhập hết hạn");
    }
    if (!res.ok) throw new Error(`Lỗi tải file mẫu (${res.status})`);
    return res.blob();
  }

  previewImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.fetchForm<ImportReport>(
      "/products/import/preview",
      formData,
    );
  }

  confirmImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.fetchForm<ImportReport>("/products/import", formData);
  }

  updateStock(id: string, stock: number) {
    return this.fetch(`/products/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ stock }),
    });
  }

  // Embedding + Publish (cho chatbot)
  embedProduct(id: string) {
    return this.fetch(`/products/${id}/embed`, { method: "PATCH" });
  }

  publishProduct(id: string) {
    return this.fetch(`/products/${id}/publish`, { method: "PATCH" });
  }

  unpublishProduct(id: string) {
    return this.fetch(`/products/${id}/unpublish`, { method: "PATCH" });
  }

  // Inventory
  getInventorySummary() {
    return this.fetch("/inventory/summary");
  }

  getInventoryProducts(params?: string) {
    return this.fetch(`/inventory/products${params ? `?${params}` : ""}`);
  }

  getStockMovements(params?: string) {
    return this.fetch(`/inventory/movements${params ? `?${params}` : ""}`);
  }

  createStockMovement(data: unknown) {
    return this.fetch("/inventory/movements", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getProductBatches(params?: string) {
    return this.fetch(`/inventory/batches${params ? `?${params}` : ""}`);
  }

  createProductBatch(data: unknown) {
    return this.fetch("/inventory/batches", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateProductBatch(id: string, data: unknown) {
    return this.fetch(`/inventory/batches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  expireProductBatch(id: string) {
    return this.fetch(`/inventory/batches/${id}/expire`, { method: "PATCH" });
  }

  getExpirationAlerts(params?: string) {
    return this.fetch(`/inventory/expiration-alerts${params ? `?${params}` : ""}`);
  }

  getFifoFefoSuggestion(params: string) {
    return this.fetch(`/inventory/fifo-fefo-suggestion?${params}`);
  }

  consumeBatches(data: unknown) {
    return this.fetch("/inventory/batches/consume", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getWarehouses() {
    return this.fetch("/inventory/warehouses");
  }

  createWarehouse(data: unknown) {
    return this.fetch("/inventory/warehouses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getStockTransfers(params?: string) {
    return this.fetch(`/inventory/transfers${params ? `?${params}` : ""}`);
  }

  createStockTransfer(data: unknown) {
    return this.fetch("/inventory/transfers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getStockAudits(params?: string) {
    return this.fetch(`/inventory/audits${params ? `?${params}` : ""}`);
  }

  createStockAudit(data: unknown) {
    return this.fetch("/inventory/audits", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getInventoryActionLogs(params?: string) {
    return this.fetch(`/inventory/action-logs${params ? `?${params}` : ""}`);
  }

  getSuppliers(params?: string) {
    return this.fetch(`/inventory/suppliers${params ? `?${params}` : ""}`);
  }

  createSupplier(data: unknown) {
    return this.fetch("/inventory/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateSupplier(id: string, data: unknown) {
    return this.fetch(`/inventory/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteSupplier(id: string) {
    return this.fetch(`/inventory/suppliers/${id}`, { method: "DELETE" });
  }

  // ── Categories ──
  getCategories(params?: string) {
    return this.fetch(`/categories${params ? `?${params}` : ""}`);
  }

  getCategory(id: string) {
    return this.fetch(`/categories/${id}`);
  }

  createCategory(data: unknown) {
    return this.fetch("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateCategory(id: string, data: unknown) {
    return this.fetch(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteCategory(id: string) {
    return this.fetch(`/categories/${id}`, { method: "DELETE" });
  }

  // ── Orders ──
  getOrders(params?: string) {
    return this.fetch(`/orders${params ? `?${params}` : ""}`);
  }

  getOrder(id: string) {
    return this.fetch(`/orders/${id}`);
  }

  getOrderByCode(code: string) {
    return this.fetch(`/orders/code/${code}`);
  }

  createOrder(data: unknown) {
    return this.fetch("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateOrder(id: string, data: unknown) {
    return this.fetch(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  updateOrderStatus(id: string, status: string) {
    return this.fetch(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  cancelOrder(id: string) {
    return this.fetch(`/orders/${id}/cancel`, { method: "PATCH" });
  }

  refundOrder(id: string) {
    return this.fetch(`/orders/${id}/refund`, { method: "PATCH" });
  }

  deleteOrder(id: string) {
    return this.fetch(`/orders/${id}`, { method: "DELETE" });
  }

  getOrderInvoice(id: string) {
    return this.fetch(`/orders/${id}/invoice`);
  }

  getOrderReport(params?: string) {
    return this.fetch(`/orders/report/summary${params ? `?${params}` : ""}`);
  }

  // ── Customers ──
  getCustomers(params?: string) {
    return this.fetch(`/customers${params ? `?${params}` : ""}`);
  }

  getCustomer(id: string) {
    return this.fetch(`/customers/${id}`);
  }

  getCustomerOrders(id: string, params?: string) {
    return this.fetch(`/customers/${id}/orders${params ? `?${params}` : ""}`);
  }

  getCustomerStats(id: string) {
    return this.fetch(`/customers/${id}/stats`);
  }

  getCustomerGroups() {
    return this.fetch("/customers/groups");
  }

  createCustomer(data: unknown) {
    return this.fetch("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateCustomer(id: string, data: unknown) {
    return this.fetch(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteCustomer(id: string) {
    return this.fetch(`/customers/${id}`, { method: "DELETE" });
  }

  // ── Chat Sessions ──
  getChatSessions(params?: string) {
    return this.fetch(`/chat-sessions${params ? `?${params}` : ""}`);
  }

  getChatSession(id: string) {
    return this.fetch(`/chat-sessions/${id}`);
  }

  getChatStats() {
    return this.fetch("/chat-sessions/stats");
  }

  // ── Dashboard Stats ──
  getDashboardStats() {
    return this.fetch("/stats/dashboard");
  }

  getInventoryValueReport() {
    return this.fetch("/stats/inventory-value");
  }

  getExpirationReport(params?: string) {
    return this.fetch(`/stats/expiration${params ? `?${params}` : ""}`);
  }

  getStockMovementReport(params?: string) {
    return this.fetch(`/stats/stock-movements${params ? `?${params}` : ""}`);
  }

  getBatchReport() {
    return this.fetch("/stats/batches");
  }

  getAdvancedInventoryReport() {
    return this.fetch("/stats/inventory-advanced");
  }

  // ── Store Config ──
  getStoreConfigs() {
    return this.fetch("/store-config");
  }

  updateStoreConfig(key: string, data: { value: string; label?: string }) {
    return this.fetch(`/store-config/${key}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ── Store Branches ──
  getStoreBranches(params?: string) {
    return this.fetch(`/store-branches${params ? `?${params}` : ""}`);
  }

  createStoreBranch(data: unknown) {
    return this.fetch("/store-branches", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateStoreBranch(id: string, data: unknown) {
    return this.fetch(`/store-branches/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteStoreBranch(id: string) {
    return this.fetch(`/store-branches/${id}`, { method: "DELETE" });
  }

  toggleStoreBranch(id: string) {
    return this.fetch(`/store-branches/${id}/toggle`, { method: "PATCH" });
  }

  // ── Email Reports (báo cáo định kỳ qua email) ──
  getEmailReports() {
    return this.fetch(`/email-reports`);
  }

  getEmailReport(id: string) {
    return this.fetch(`/email-reports/${id}`);
  }

  createEmailReport(data: unknown) {
    return this.fetch(`/email-reports`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateEmailReport(id: string, data: unknown) {
    return this.fetch(`/email-reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  deleteEmailReport(id: string) {
    return this.fetch(`/email-reports/${id}`, { method: "DELETE" });
  }

  toggleEmailReport(id: string) {
    return this.fetch(`/email-reports/${id}/toggle`, { method: "PATCH" });
  }

  sendEmailReportNow(id: string) {
    return this.fetch(`/email-reports/${id}/send-now`, { method: "POST" });
  }
}

export const apiClient = new ApiClient();
