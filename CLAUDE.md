# CLAUDE.md — Vegetarian Food Store Chatbot & Management System

## Tổng quan dự án

Hệ thống chatbot tư vấn và quản lý bán hàng thực phẩm chay online. Gồm **3 service chính** chạy độc lập, giao tiếp qua REST API:

1. **Admin Panel (Next.js)** — Giao diện quản lý sản phẩm, đơn hàng, khách hàng dành cho nhân viên cửa hàng.
2. **Backend API (NestJS)** — Xử lý business logic, CRUD sản phẩm/đơn hàng, xác thực, cung cấp data cho cả Admin Panel và Chatbot Service.
3. **Chatbot Service (Python)** — Service độc lập nhận webhook từ **Zalo OA** và **Facebook Messenger**, sử dụng OpenAI LLM để tư vấn sản phẩm, tra cứu đơn hàng. Gọi nội bộ sang NestJS API để lấy dữ liệu thực tế.

### Kiến trúc tổng thể

```
┌─────────────┐   ┌─────────────┐
│   Zalo OA   │   │  Messenger   │   ← Khách hàng chat qua nền tảng
└──────┬──────┘   └──────┬──────┘
       │ Webhook          │ Webhook
       ▼                  ▼
┌────────────────────────────────┐
│   Chatbot Service (Python)     │
│   - Nhận webhook Zalo/Messenger│
│   - Xử lý tin nhắn với OpenAI  │
│   - Function calling → API     │
│   - Gửi phản hồi lại platform  │
└──────────────┬─────────────────┘
               │ HTTP (internal)
               ▼
┌────────────────────────────────┐
│   Backend API (NestJS)         │
│   - Products / Orders / Auth   │
│   - REST API cho Admin & Bot   │
│   - PostgreSQL (Prisma ORM)    │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│   Admin Panel (Next.js)        │
│   - Dashboard / CRUD / Stats   │
│   - Gọi NestJS API             │
└────────────────────────────────┘
```

---

## Tech Stack

| Service | Công nghệ |
|---|---|
| **Admin Panel** | Next.js 14+ (App Router, TypeScript, TailwindCSS, shadcn/ui) |
| **Backend API** | NestJS (TypeScript, Prisma ORM) |
| **Database** | PostgreSQL |
| **Chatbot Service** | Python 3.11+ (FastAPI, OpenAI SDK) |
| **AI/LLM** | OpenAI API (GPT-4o / GPT-4o-mini) với Function Calling |
| **Chat Platforms** | Zalo Official Account (OA) + Facebook Messenger |
| **Authentication** | JWT (Admin login), API Key (Bot → NestJS internal) |
| **File Storage** | Cloudinary |

---

## Cấu trúc thư mục — Monorepo

```
Chatbot/
├── CLAUDE.md                      # File này
├── README.md
├── docker-compose.yml             # Chạy cả 3 service + PostgreSQL
├── .env.example
├── .gitignore
│
├── backend/                       # ── NestJS API ──
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Dữ liệu mẫu
│   ├── src/
│   │   ├── main.ts                # Bootstrap NestJS
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── dto/
│   │   ├── products/
│   │   │   ├── products.module.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   └── dto/
│   │   ├── orders/
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   └── dto/
│   │   ├── customers/
│   │   │   ├── customers.module.ts
│   │   │   ├── customers.controller.ts
│   │   │   ├── customers.service.ts
│   │   │   └── dto/
│   │   ├── chat-sessions/         # Lưu lịch sử chat từ Zalo/Messenger
│   │   │   ├── chat-sessions.module.ts
│   │   │   ├── chat-sessions.controller.ts
│   │   │   ├── chat-sessions.service.ts
│   │   │   └── dto/
│   │   ├── bot-api/               # API nội bộ cho Chatbot Service gọi
│   │   │   ├── bot-api.module.ts
│   │   │   ├── bot-api.controller.ts
│   │   │   └── bot-api.guard.ts    # Xác thực bằng API Key
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   ├── pipes/
│   │   │   └── utils/
│   │   └── prisma/
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts
│   └── test/
│
├── admin/                         # ── Next.js Admin Panel ──
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx       # Sidebar + Header
│   │   │   │   ├── page.tsx         # Dashboard thống kê
│   │   │   │   ├── products/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── orders/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── customers/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── chat-logs/       # Xem lịch sử chat từ Zalo/Messenger
│   │   │   │       └── page.tsx
│   │   │   └── api/                 # Next.js API routes (proxy nếu cần)
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── layout/
│   │   │   ├── products/
│   │   │   ├── orders/
│   │   │   └── shared/
│   │   ├── lib/
│   │   │   ├── api-client.ts        # Client gọi NestJS API
│   │   │   └── utils.ts
│   │   └── hooks/
│   └── public/
│
└── chatbot/                       # ── Python Chatbot Service ──
    ├── pyproject.toml              # Poetry / pip config
    ├── requirements.txt
    ├── Dockerfile
    ├── .env.example
    ├── src/
    │   ├── __init__.py
    │   ├── main.py                 # FastAPI app, mount webhook routes
    │   ├── config.py               # Load env vars (pydantic-settings)
    │   ├── clients/
    │   │   ├── __init__.py
    │   │   ├── backend_api.py       # HTTP client gọi NestJS API
    │   │   ├── zalo_client.py       # Gửi tin nhắn qua Zalo OA API
    │   │   └── messenger_client.py  # Gửi tin nhắn qua Messenger API
    │   ├── webhooks/
    │   │   ├── __init__.py
    │   │   ├── zalo_webhook.py      # Endpoint nhận webhook từ Zalo OA
    │   │   └── messenger_webhook.py # Endpoint nhận webhook từ Messenger
    │   ├── chatbot/
    │   │   ├── __init__.py
    │   │   ├── agent.py             # Chatbot agent — gọi OpenAI API
    │   │   ├── tools.py             # Function calling tools định nghĩa
    │   │   ├── tool_executor.py     # Thực thi tools → gọi NestJS API
    │   │   ├── prompts.py           # System prompt & templates
    │   │   └── session.py           # Quản lý phiên chat (in-memory + DB)
    │   ├── models/
    │   │   ├── __init__.py
    │   │   ├── message.py           # Pydantic models cho tin nhắn
    │   │   └── webhook.py           # Pydantic models cho webhook payload
    │   └── utils/
    │       ├── __init__.py
    │       └── helpers.py
    └── tests/
        ├── __init__.py
        ├── test_agent.py
        ├── test_tools.py
        └── test_webhooks.py
```

---

## Database Schema (Prisma — trong `backend/`)

### Các model chính

```prisma
// Sản phẩm thực phẩm chay
model Product {
  id            String   @id @default(uuid())
  name          String                    // Tên sản phẩm (VD: "Đậu hũ hữu cơ")
  slug          String   @unique          // URL-friendly name
  description   String                    // Mô tả chi tiết
  shortDesc     String?                   // Mô tả ngắn cho chatbot
  price         Float                     // Giá (VND)
  salePrice     Float?                    // Giá khuyến mãi
  category      ProductCategory           // Danh mục
  tags          String[]                  // Tags: ["organic", "gluten-free", "vegan"]
  ingredients   String?                   // Thành phần
  nutritionInfo Json?                     // Thông tin dinh dưỡng
  allergens     String[]                  // Chất gây dị ứng
  origin        String?                   // Nguồn gốc xuất xứ
  images        String[]                  // URLs ảnh sản phẩm
  stock         Int                       // Số lượng tồn kho
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  orderItems    OrderItem[]
}

enum ProductCategory {
  FRESH           // Thực phẩm tươi (rau, củ, quả)
  DRIED           // Thực phẩm khô (hạt, đậu, nấm khô)
  SEASONING       // Gia vị, nước chấm chay
  FROZEN          // Thực phẩm đông lạnh
  BEVERAGE        // Đồ uống (nước ép, trà thảo mộc)
  SNACK           // Đồ ăn vặt chay
  SUPPLEMENT      // Thực phẩm bổ sung, dinh dưỡng
  READY_TO_EAT    // Món ăn sẵn, đồ hộp chay
}

// Đơn hàng
model Order {
  id            String      @id @default(uuid())
  orderCode     String      @unique        // Mã đơn hàng (VD: VEG-20260604-001)
  customerId    String
  customer      Customer    @relation(fields: [customerId], references: [id])
  items         OrderItem[]
  totalAmount   Float                      // Tổng tiền
  discount      Float       @default(0)
  finalAmount   Float                      // Thành tiền
  status        OrderStatus @default(PENDING)
  shippingAddress String
  shippingPhone   String
  note          String?                    // Ghi chú từ khách
  paymentMethod PaymentMethod
  paidAt        DateTime?
  shippedAt     DateTime?
  deliveredAt   DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

enum OrderStatus {
  PENDING        // Chờ xác nhận
  CONFIRMED      // Đã xác nhận
  PROCESSING     // Đang chuẩn bị
  SHIPPED        // Đang giao
  DELIVERED      // Đã giao
  CANCELLED      // Đã hủy
  REFUNDING      // Đang hoàn tiền
  REFUNDED       // Đã hoàn tiền
}

enum PaymentMethod {
  COD             // Thanh toán khi nhận hàng
  BANK_TRANSFER   // Chuyển khoản
  MOMO            // Ví MoMo
  VNPAY           // VNPay
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Float                         // Giá tại thời điểm đặt
}

// Khách hàng
model Customer {
  id        String   @id @default(uuid())
  name      String
  phone     String   @unique
  email     String?
  address   String?
  orders    Order[]
  chatSessions ChatSession[]
  createdAt DateTime @default(now())
}

// Phiên chat — đồng bộ từ Chatbot Service
model ChatSession {
  id            String       @id @default(uuid())
  customerId    String?
  customer      Customer?    @relation(fields: [customerId], references: [id])
  platform      ChatPlatform                  // ZALO | MESSENGER
  platformUserId String                       // ID user trên platform (Zalo user id / PSID)
  guestPhone    String?                        // SĐT nếu khách cung cấp
  messages      ChatMessage[]
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([platform, platformUserId])  // 1 user trên mỗi platform = 1 session
}

model ChatMessage {
  id         String      @id @default(uuid())
  sessionId  String
  session    ChatSession @relation(fields: [sessionId], references: [id])
  role       MessageRole
  content    String
  metadata   Json?                        // Tool calls, function results, platform msg id
  createdAt  DateTime    @default(now())
}

enum ChatPlatform {
  ZALO
  MESSENGER
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}
```

---

## Chatbot Service (Python) — Chi tiết

### Luồng xử lý webhook

```
Khách gửi tin nhắn trên Zalo / Messenger
    │
    ▼
Platform gửi POST → Webhook URL (Chatbot Service)
    │
    ▼
┌──────────────────────────────────────────┐
│  Webhook Handler (zalo_webhook /         │
│                   messenger_webhook)     │
│  - Verify webhook (token challenge)      │
│  - Parse payload → user_id + message     │
│  - Ghi nhận USER message vào DB          │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Chatbot Agent (agent.py)                │
│  - Load hoặc tạo session (theo          │
│    platform + platform_user_id)          │
│  - Build context: system prompt +        │
│    lịch sử chat + OpenAI tools           │
│  - Gọi OpenAI API                        │
└──────────────────┬───────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   Text response       Function call
   (trả thẳng)         (gọi tool)
         │                   │
         │                   ▼
         │          ┌──────────────────────┐
         │          │  Tool Executor       │
         │          │  (tool_executor.py)  │
         │          │  Gọi NestJS API nội  │
         │          │  bộ để lấy data      │
         │          └──────────┬───────────┘
         │                     │
         │                     ▼
         │             Kết quả trả về OpenAI
         │             → Tạo text response
         │                     │
         └─────────┬───────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Platform Client (zalo_client /          │
│                   messenger_client)      │
│  - Gửi tin nhắn phản hồi qua API        │
│  - Hỗ trợ gửi carousel / quick reply    │
│  - Ghi nhận ASSISTANT message vào DB     │
└──────────────────────────────────────────┘
```

### OpenAI Function Calling Tools

Chatbot Python gọi **NestJS internal API** (`/api/bot/*`) để lấy dữ liệu:

| Tool | Gọi API tương ứng | Mô tả |
|---|---|---|
| `search_products(query, category?, tags?)` | `GET /api/bot/products?q=&category=` | Tìm kiếm sản phẩm |
| `get_product_detail(product_id)` | `GET /api/bot/products/:id` | Chi tiết 1 sản phẩm |
| `check_order_status(order_code)` | `GET /api/bot/orders/code/:code` | Tra cứu đơn hàng bằng mã đơn |
| `get_customer_orders(phone)` | `GET /api/bot/customers/phone/:phone/orders` | Lịch sử đơn theo SĐT |
| `check_stock(product_id)` | `GET /api/bot/products/:id/stock` | Kiểm tra tồn kho |
| `get_categories()` | `GET /api/bot/categories` | Danh sách danh mục |
| `suggest_products(preferences)` | `GET /api/bot/products/suggest?prefs=` | Gợi ý theo sở thích |

### Python Libraries (requirements.txt)

```
fastapi>=0.115.0
uvicorn>=0.34.0
openai>=1.60.0
httpx>=0.28.0          # Async HTTP client gọi NestJS API
pydantic>=2.10.0
pydantic-settings>=2.7.0
python-dotenv>=1.0.0
redis>=5.0.0           # Cache session (optional)
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

### System Prompt (tóm tắt)

```
Bạn là trợ lý tư vấn của cửa hàng thực phẩm chay [Tên cửa hàng].
Kênh tư vấn: Zalo / Facebook Messenger.

Nhiệm vụ:
- Tư vấn sản phẩm thực phẩm chay phù hợp nhu cầu khách hàng
- Giải đáp thắc mắc về sản phẩm (thành phần, dinh dưỡng, nguồn gốc, cách chế biến)
- Tra cứu thông tin đơn hàng (yêu cầu mã đơn hàng hoặc số điện thoại)
- Hỗ trợ hướng dẫn mua sắm

Quy tắc:
- Luôn thân thiện, lịch sự, nhiệt tình
- Ưu tiên tư vấn dựa trên dữ liệu thực tế (dùng tools)
- Không bịa thông tin — nếu không biết, nói "để tôi kiểm tra lại cho bạn"
- Nếu khách hỏi ngoài phạm vi, lịch sự từ chối
- Sử dụng tiếng Việt
- Giá cả hiển thị bằng VNĐ (VD: 45.000đ)
- Tôn trọng mọi lý do ăn chay (sức khỏe, tôn giáo, môi trường...)
- Trả lời ngắn gọn, phù hợp nhắn tin trên Zalo/Messenger
- Có thể gửi nhiều tin nhắn ngắn liên tiếp thay vì 1 tin quá dài
- Không hỏi thông tin cá nhân không cần thiết
```

---

## NestJS API Endpoints

### Auth (Admin)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập admin |
| POST | `/api/auth/refresh` | Refresh token |

### Products (Admin — yêu cầu JWT)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/products` | Danh sách sản phẩm (filter, paginate, sort) |
| GET | `/api/products/:id` | Chi tiết sản phẩm |
| POST | `/api/products` | Tạo sản phẩm mới |
| PUT | `/api/products/:id` | Cập nhật sản phẩm |
| DELETE | `/api/products/:id` | Xóa mềm (isActive=false) |
| PATCH | `/api/products/:id/stock` | Cập nhật tồn kho |

### Orders (Admin — yêu cầu JWT)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/orders` | Danh sách đơn hàng (filter, paginate, sort) |
| GET | `/api/orders/:id` | Chi tiết đơn hàng |
| GET | `/api/orders/code/:code` | Tìm theo mã đơn |
| POST | `/api/orders` | Tạo đơn hàng mới |
| PATCH | `/api/orders/:id/status` | Cập nhật trạng thái |
| PATCH | `/api/orders/:id/cancel` | Hủy đơn hàng |

### Customers (Admin — yêu cầu JWT)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/customers` | Danh sách khách hàng |
| GET | `/api/customers/:id` | Chi tiết khách |
| GET | `/api/customers/:id/orders` | Đơn hàng của khách |

### Chat Logs (Admin — yêu cầu JWT)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/chat-sessions` | Danh sách phiên chat (filter theo platform) |
| GET | `/api/chat-sessions/:id` | Chi tiết + lịch sử tin nhắn |
| GET | `/api/chat-sessions/stats` | Thống kê chat (số session, câu hỏi phổ biến) |

### Bot Internal API (chỉ cho Chatbot Service — xác thực bằng API Key)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/bot/products` | Tìm kiếm sản phẩm (cho tool `search_products`) |
| GET | `/api/bot/products/:id` | Chi tiết sản phẩm |
| GET | `/api/bot/products/:id/stock` | Kiểm tra tồn kho |
| GET | `/api/bot/products/suggest` | Gợi ý sản phẩm |
| GET | `/api/bot/categories` | Danh mục sản phẩm |
| GET | `/api/bot/orders/code/:code` | Tra cứu đơn hàng |
| GET | `/api/bot/customers/phone/:phone/orders` | Đơn hàng theo SĐT |
| POST | `/api/bot/chat-sessions` | Tạo / cập nhật session từ bot |
| POST | `/api/bot/chat-sessions/:id/messages` | Lưu tin nhắn từ bot |

---

## Tích hợp Zalo OA Webhook

### Cấu hình Zalo Official Account
1. Tạo OA tại [Zalo OA Platform](https://oa.zalo.me/)
2. Cấu hình Webhook URL: `https://your-domain.com/webhooks/zalo`
3. Lấy OA Access Token và cấu hình trong `.env`

### Webhook endpoints (trong Chatbot Service)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/webhooks/zalo` | Verify webhook (Zalo challenge) |
| POST | `/webhooks/zalo` | Nhận tin nhắn / sự kiện từ Zalo OA |

### Xử lý sự kiện Zalo
- `user_send_text` → Khách gửi tin nhắn văn bản → xử lý bằng AI
- `user_send_image` → Khách gửi ảnh → phản hồi mặc định (không xử lý ảnh trong MVP)
- `follow` → Khách quan tâm OA → gửi tin chào mừng
- `user_send_sticker` → Bỏ qua hoặc phản hồi vui

### Gửi tin nhắn Zalo
- API: `POST https://openapi.zalo.me/v3.0/oa/message`
- Hỗ trợ: text, attachment (ảnh sản phẩm), list template (danh sách SP)
- Rate limit: tuân thủ giới hạn của Zalo API

---

## Tích hợp Facebook Messenger Webhook

### Cấu hình Facebook App
1. Tạo Facebook App tại [Meta for Developers](https://developers.facebook.com/)
2. Thêm sản phẩm Messenger, cấu hình Webhook
3. Webhook URL: `https://your-domain.com/webhooks/messenger`
4. Subscribe các events: `messages`, `messaging_postbacks`
5. Lấy Page Access Token và cấu hình trong `.env`

### Webhook endpoints (trong Chatbot Service)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/webhooks/messenger` | Verify webhook (hub.challenge) |
| POST | `/webhooks/messenger` | Nhận tin nhắn / sự kiện từ Messenger |

### Xử lý sự kiện Messenger
- `messages` (text) → Xử lý bằng AI
- `messages` (attachments/image) → Phản hồi mặc định
- `messaging_postbacks` → Xử lý nút "Bắt đầu" / "Get Started"
- Ignore `message_echoes` (tin nhắn từ chính page)

### Gửi tin nhắn Messenger
- API: `POST https://graph.facebook.com/v21.0/{page-id}/messages`
- Hỗ trợ: text, template (generic, button), quick replies
- Rate limit: tuân thủ giới hạn của Meta API

---

## Biến môi trường

### `backend/.env` (NestJS)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/veg_shop

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# Bot API Key (dùng để xác thực request từ Chatbot Service)
BOT_API_KEY=your-secure-api-key-here

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

### `admin/.env` (Next.js)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=VeggieShop Admin
```

### `chatbot/.env` (Python)

```env
# Chatbot Service
PORT=8000
HOST=0.0.0.0

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MODEL_ADVANCED=gpt-4o

# NestJS Backend (internal)
BACKEND_API_URL=http://localhost:3000/api/bot
BOT_API_KEY=your-secure-api-key-here    # Phải trùng với backend

# Zalo OA
ZALO_OA_ID=your-oa-id
ZALO_OA_ACCESS_TOKEN=your-access-token
ZALO_WEBHOOK_VERIFY_TOKEN=your-verify-token

# Facebook Messenger
FB_PAGE_ID=your-page-id
FB_PAGE_ACCESS_TOKEN=your-page-access-token
FB_APP_SECRET=your-app-secret
FB_WEBHOOK_VERIFY_TOKEN=your-verify-token

# Session
SESSION_TTL_HOURS=24
```

---

## Quy tắc phát triển

### Code Style
- **NestJS (backend/)**: TypeScript strict, Prettier + ESLint
- **Next.js (admin/)**: TypeScript strict, TailwindCSS, shadcn/ui
- **Python (chatbot/)**: Black formatter, isort, flake8, type hints bắt buộc
- **Naming**:
  - TS files: `kebab-case.ts` / `PascalCase.tsx`
  - Python files: `snake_case.py`
  - TS variables: `camelCase`
  - Python variables: `snake_case`
  - DB fields: `camelCase` (Prisma convention)
- **Comments**: Tiếng Việt cho business logic, tiếng Anh cho code kỹ thuật

### Git Convention
- Branch: `feature/`, `bugfix/`, `hotfix/`, `chore/`
- Commit message: Tiếng Anh, conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Scope prefix theo service: `feat(backend):`, `feat(chatbot):`, `feat(admin):`

### Testing
- **NestJS**: Unit tests (Jest) cho services, Integration tests cho endpoints
- **Python**: Unit tests (pytest) cho agent tools, Integration tests cho webhooks
- Chatbot test: Mock NestJS API responses, kiểm tra agent gọi đúng tool + trả lời phù hợp

### Security
- **Bot API Key**: Chatbot Service gọi NestJS qua HTTPS với API Key header, KHÔNG dùng JWT
- **Webhook verification**: Verify token cho cả Zalo và Messenger webhook
- **Rate limiting**: Áp dụng trên webhook endpoints để chống spam
- **Không expose raw DB errors** qua bất kỳ API nào
- **Không cho bot truy vấn dữ liệu admin** — chỉ sản phẩm active + đơn hàng của chính khách đó

---

## Hành vi Chatbot — Quy tắc quan trọng

### Phạm vi trả lời
| ✅ NÊN trả lời | ❌ KHÔNG trả lời |
|---|---|
| Tư vấn sản phẩm thực phẩm chay | Thông tin y tế, chẩn đoán bệnh |
| Giải đáp thành phần, dinh dưỡng sản phẩm | Khuyến nghị thay thế thuốc chữa bệnh |
| Tra cứu đơn hàng, trạng thái giao hàng | Thông tin nội bộ (doanh thu, lợi nhuận) |
| Hướng dẫn mua sắm, đặt hàng | Lời khuyên y tế chuyên sâu |
| Gợi ý món ăn, công thức nấu ăn chay | Chủ đề chính trị, tôn giáo phân biệt |
| So sánh sản phẩm | Thông tin cá nhân nhân viên |

### Xử lý edge cases
- **Khách hỏi sản phẩm không có**: Đề xuất sản phẩm tương tự, ghi nhận yêu cầu
- **Khách hỏi đơn hàng không tồn tại**: Yêu cầu kiểm tra lại mã đơn hoặc cung cấp SĐT
- **Khách hỏi ngoài phạm vi**: Lịch sự chuyển hướng về chủ đề thực phẩm chay
- **Tồn kho = 0**: Thông báo hết hàng, đề xuất sản phẩm thay thế
- **Khách phàn nàn**: Đồng cảm, xin lỗi, đề xuất liên hệ hotline, đánh dấu priority trong session

### Đặc thù Zalo / Messenger
- **Tin nhắn ngắn**: Ưu tiên trả lời ngắn gọn (< 200 chữ/tin), có thể gửi nhiều tin liên tiếp
- **Quick Reply**: Dùng quick reply buttons cho lựa chọn phổ biến (VD: "Xem menu", "Tra đơn hàng")
- **Carousel/Sản phẩm**: Dùng Zalo list template hoặc Messenger generic template để hiển thị danh sách sản phẩm
- **Chào mừng**: Khi khách mới bắt đầu conversation → gửi tin chào + menu quick reply
- **Hình ảnh sản phẩm**: Khi tư vấn 1 sản phẩm cụ thể → gửi kèm ảnh sản phẩm qua attachment

---

## Docker Compose (development)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: veg_shop
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file: ./backend/.env
    depends_on:
      - postgres

  admin:
    build: ./admin
    ports:
      - "4000:4000"
    env_file: ./admin/.env
    depends_on:
      - backend

  chatbot:
    build: ./chatbot
    ports:
      - "8000:8000"
    env_file: ./chatbot/.env
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## Lệnh thường dùng

### Backend (NestJS)
```bash
cd backend
npm install
npm run dev                    # Development server
npx prisma migrate dev         # Chạy migration
npx prisma db seed             # Seed dữ liệu mẫu
npx prisma generate            # Tạo Prisma client
npm test                       # Chạy tests
npm run build                  # Build production
```

### Admin (Next.js)
```bash
cd admin
npm install
npm run dev                    # Development server (port 4000)
npm run build                  # Build production
npm run start                  # Production server
```

### Chatbot (Python)
```bash
cd chatbot
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000   # Development server
pytest                        # Chạy tests
```

### Docker
```bash
docker-compose up -d           # Chạy tất cả services
docker-compose logs -f chatbot # Xem log chatbot
docker-compose down            # Dừng tất cả
```

---

## Ghi chú bổ sung

- **Chatbot Service là stateless** — session data lưu trong PostgreSQL qua NestJS API, không lưu in-memory để dễ scale
- **Webhook cần HTTPS** — dùng ngrok cho development, Cloudflare tunnel hoặc reverse proxy cho production
- **Fallback**: Nếu OpenAI API lỗi → trả tin mặc định "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng liên hệ hotline..."
- **Lưu toàn bộ lịch sử chat** vào DB để admin xem được và phân tích cải thiện
- **Admin dashboard** hiển thị: số lượng chat theo platform, câu hỏi phổ biến, sản phẩm được hỏi nhiều nhất
- **Function calling** ưu tiên hơn RAG vì dữ liệu có cấu trúc rõ ràng
- **Mở rộng sau này**: RAG cho FAQ / kiến thức ăn chay, gửi thông báo đơn hàng qua Zalo/Messenger, tích hợp thanh toán
