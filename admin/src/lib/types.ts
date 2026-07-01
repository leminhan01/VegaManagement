// ── Category ──
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

// ── Product ──
export type ProductCategory =
  | "FRESH"
  | "DRIED"
  | "SEASONING"
  | "FROZEN"
  | "BEVERAGE"
  | "SNACK"
  | "SUPPLEMENT"
  | "READY_TO_EAT";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDesc?: string;
  price: number;
  salePrice?: number;
  categoryId: string;
  category?: Category;
  tags: string[];
  ingredients?: string;
  nutritionInfo?: Record<string, unknown>;
  allergens: string[];
  origin?: string;
  images: string[];
  stock: number;
  minStock: number;
  sku: string;
  unit: string;
  isActive: boolean;
  isPublished: boolean;
  embeddedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Product Excel Import ──
export type ImportAction = "create" | "update" | "error";

export interface ImportRowReport {
  rowNo: number;
  sku: string;
  name: string;
  action: ImportAction;
  errors: string[];
}

export interface ImportReport {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  rows: ImportRowReport[];
}

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT";
export type StockAuditStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type BatchStatus = "ACTIVE" | "EXPIRED" | "CONSUMED" | "RECALLED";
export type FulfillmentStrategy = "FIFO" | "FEFO";
export type InventoryActionType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "STOCK_ADJUST"
  | "STOCK_AUDIT"
  | "STOCK_TRANSFER"
  | "SUPPLIER_CREATE"
  | "SUPPLIER_UPDATE"
  | "SUPPLIER_ARCHIVE"
  | "WAREHOUSE_CREATE"
  | "WAREHOUSE_UPDATE"
  | "BATCH_CREATE"
  | "BATCH_EXPIRE"
  | "BATCH_CONSUME";

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { stockMovements: number };
}

export interface StockMovement {
  id: string;
  productId: string;
  product: Pick<Product, "id" | "name" | "sku" | "unit">;
  supplierId?: string;
  supplier?: Pick<Supplier, "id" | "name">;
  type: StockMovementType;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  unitCost?: number;
  reason?: string;
  reference?: string;
  batchId?: string;
  createdAt: string;
}

export interface ProductBatch {
  id: string;
  batchCode: string;
  productId: string;
  product: Pick<Product, "id" | "name" | "sku" | "unit">;
  supplierId?: string;
  supplier?: Pick<Supplier, "id" | "name">;
  warehouseId?: string;
  warehouse?: Pick<Warehouse, "id" | "name" | "code">;
  initialQuantity: number;
  remainingQty: number;
  unitCost?: number;
  receivedAt: string;
  expirationDate?: string;
  manufactureDate?: string;
  status: BatchStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpirationAlert extends ProductBatch {
  daysUntilExpiration: number;
  alertLevel: "expired" | "critical" | "warning";
}

export interface FifoFefoSuggestion {
  strategy: FulfillmentStrategy;
  requestedQuantity: number;
  availableQuantity: number;
  shortage: number;
  allocations: Array<{
    batchId: string;
    batchCode: string;
    quantity: number;
    remainingQty: number;
    expirationDate?: string;
    receivedAt: string;
    warehouse?: Pick<Warehouse, "id" | "name" | "code">;
  }>;
}

// Sub-types cho các endpoint /stats riêng lẻ (cùng shape với AdvancedInventoryReport).
export type InventoryValueReport = AdvancedInventoryReport["inventoryValue"];
export type ExpirationReport = AdvancedInventoryReport["expiration"];
export type StockMovementReport = AdvancedInventoryReport["movement"];

export interface AdvancedInventoryReport {
  inventoryValue: {
    totalValue: number;
    totalStock: number;
    byCategory: Array<{
      categoryId: string | null;
      categoryName: string;
      stock: number;
      value: number;
    }>;
    topProducts: Array<{
      id: string;
      name: string;
      sku: string;
      stock: number;
      value: number;
      category: string | null;
    }>;
  };
  expiration: {
    daysThreshold: number;
    expiredCount: number;
    expiringSoonCount: number;
    expiredQuantity: number;
    expiringSoonQuantity: number;
    batches: ExpirationAlert[];
  };
  movement: {
    days: number;
    totalMovements: number;
    byType: Record<string, number>;
    byDay: Array<{ day: string; in: number; out: number; adjustment: number }>;
    recentMovements: StockMovement[];
  };
  batch: {
    totalBatches: number;
    activeQuantity: number;
    consumedQuantity: number;
    byStatus: Record<string, number>;
    recentBatches: ProductBatch[];
  };
  generatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { stocks: number };
}

export interface StockTransfer {
  id: string;
  transferCode: string;
  productId: string;
  product: Pick<Product, "id" | "name" | "sku" | "unit">;
  fromWarehouseId: string;
  fromWarehouse: Pick<Warehouse, "id" | "name" | "code">;
  toWarehouseId: string;
  toWarehouse: Pick<Warehouse, "id" | "name" | "code">;
  quantity: number;
  reason?: string;
  reference?: string;
  createdAt: string;
}

export interface StockAuditItem {
  id: string;
  productId: string;
  product: Pick<Product, "id" | "name" | "sku" | "unit">;
  systemStock: number;
  countedStock: number;
  difference: number;
  note?: string;
}

export interface StockAudit {
  id: string;
  auditCode: string;
  warehouseId?: string;
  warehouse?: Pick<Warehouse, "id" | "name" | "code">;
  status: StockAuditStatus;
  note?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: StockAuditItem[];
}

export interface InventoryActionLog {
  id: string;
  action: InventoryActionType;
  entityType: string;
  entityId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface InventorySummary {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  supplierCount: number;
  warehouseCount: number;
  pendingAuditCount: number;
  lowStockProducts: Array<
    Pick<Product, "id" | "name" | "sku" | "stock" | "minStock" | "unit"> & {
      category?: Pick<Category, "name">;
    }
  >;
  outOfStockProducts: Array<
    Pick<Product, "id" | "name" | "sku" | "stock" | "minStock" | "unit"> & {
      category?: Pick<Category, "name">;
    }
  >;
  recentMovements: StockMovement[];
}

// ── Order ──
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDING"
  | "REFUNDED";

export type PaymentMethod = "COD" | "BANK_TRANSFER" | "MOMO" | "VNPAY";

export interface OrderItem {
  id: string;
  orderId?: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  batchId?: string;
  batch?: ProductBatch;
}

export interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  customer: Customer;
  items: OrderItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  status: OrderStatus;
  shippingAddress: string;
  shippingPhone: string;
  note?: string;
  paymentMethod: PaymentMethod;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderInvoice {
  invoiceNo: string;
  issuedAt: string;
  seller: {
    name: string;
    phone: string;
    address: string;
  };
  order: Order;
  totals: {
    totalAmount: number;
    discount: number;
    finalAmount: number;
  };
}

export interface OrderReport {
  totalOrders: number;
  revenue: number;
  pendingValue: number;
  averageOrderValue: number;
  byStatus: Array<{
    status: OrderStatus;
    _count: { _all: number };
    _sum: { finalAmount: number | null };
  }>;
  byPayment: Array<{
    paymentMethod: PaymentMethod;
    _count: { _all: number };
    _sum: { finalAmount: number | null };
  }>;
  topProducts: Array<{
    product: Partial<Pick<Product, "id" | "name" | "sku" | "unit">>;
    quantity: number;
    orderLines: number;
  }>;
  daily: Array<{ day: string; orders: number; revenue: number }>;
  generatedAt: string;
}

// ── Customer ──
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  shippingAddresses?: ShippingAddress[];
  tags: string[];
  group: string;
  note?: string;
  orders?: Order[];
  orderCount?: number;
  totalOrders?: number;
  completedOrders?: number;
  activeOrders?: number;
  totalSpent?: number;
  averageOrderValue?: number;
  lastOrderAt?: string | null;
  suggestedGroup?: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { orders: number };
}

export interface ShippingAddress {
  label?: string;
  receiverName?: string;
  phone?: string;
  address: string;
  isDefault?: boolean;
}

export interface CustomerStats {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderAt?: string | null;
  group: string;
  suggestedGroup: string;
  topProducts: Array<{
    product: Partial<Pick<Product, "id" | "name" | "sku">>;
    quantity: number;
    amount: number;
  }>;
}

export interface CustomerGroups {
  groups: Array<{ name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
}

// ── Chat ──
export type ChatPlatform = "ZALO" | "MESSENGER";

export interface ChatSession {
  id: string;
  platform: ChatPlatform;
  platformUserId: string;
  isActive: boolean;
  customer?: Customer;
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  metadata?: unknown;
  createdAt: string;
}

// ── Dashboard Stats ──
export interface DashboardStats {
  revenue: {
    current: number;
    previous: number;
    change: number;
  };
  orders: {
    total: number;
    thisMonth: number;
    change: number;
  };
  lowStockProducts: Array<{
    id: string;
    name: string;
    stock: number;
    minStock: number;
    category: string | null;
  }>;
  newCustomers: number;
  revenueByDay: Array<{
    day: string;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderCode: string;
    customerName: string;
    status: OrderStatus;
    finalAmount: number;
    createdAt: string;
  }>;
}

// ── Auth ──
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    username: string;
  };
}

// ── Pagination ──
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ── Email Reports (báo cáo định kỳ qua email) ──
export type EmailReportSection =
  | "sales"
  | "top_products"
  | "order_status"
  | "payment_methods"
  | "low_stock"
  | "expiration";

export interface EmailReportConfig {
  id: string;
  name: string;
  recipients: string[];
  intervalHours: number;
  sections: EmailReportSection[];
  isActive: boolean;
  lastSentAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  _count?: { logs: number };
}

export type EmailLogStatus = "PENDING" | "SENT" | "FAILED";

export interface EmailLog {
  id: string;
  reportConfigId: string;
  recipients: string[];
  subject: string;
  status: EmailLogStatus;
  error: string | null;
  sentAt: string | null;
  payloadSummary: Record<string, unknown> | null;
  createdAt: string;
}

export interface EmailReportSendResult {
  sent: boolean;
  recipients: string[];
  summary: Record<string, unknown>;
}

