# 🌿 VegiFlow — Hệ thống quản lý & chatbot cửa hàng thực phẩm chay

Hệ thống gồm 3 service chạy độc lập, giao tiếp qua REST API:

| Service | Công nghệ | Port |
|---------|-----------|------|
| **Backend API** | NestJS + Prisma ORM + PostgreSQL | 3000 |
| **Admin Panel** | Next.js 16 + TailwindCSS v4 | 4000 |
| **Chatbot Service** | Python FastAPI + OpenAI API | 8000 |

## Kiến trúc

```
Zalo/Messenger → Chatbot Service (Python) → Backend API (NestJS) → PostgreSQL
Admin Panel (Next.js) → Backend API (NestJS) → PostgreSQL
```

## Quick Start

### 0. Setup lần đầu

```bash
# Cài dependencies cho cả monorepo
pnpm install

# Chạy migration + seed database
pnpm db:migrate
pnpm db:seed
```

### 1. Chạy tất cả services (Turbo)

```bash
# Chỉ Backend + Admin (qua Turborepo)
pnpm dev

# Hoặc TẤT CẢ: PostgreSQL + Backend + Admin + Chatbot
pnpm dev:all
```

### 2. Chạy thủ công từng service

**PostgreSQL:**
```bash
docker compose up -d postgres
```

**Backend API:**
```bash
cd backend
cp .env.example .env          # Cấu hình DATABASE_URL, JWT_SECRET, BOT_API_KEY
pnpm install
npx prisma migrate dev        # Chạy migration
npx prisma db seed            # Seed dữ liệu mẫu
pnpm dev                      # http://localhost:3000
```

**Admin Panel:**
```bash
cd admin
cp .env.example .env          # Cấu hình NEXT_PUBLIC_API_URL
pnpm install
pnpm dev                      # http://localhost:4000
```

**Chatbot Service:**
```bash
cd chatbot
cp .env.example .env          # Cấu hình OPENAI_API_KEY, Zalo/Messenger tokens
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## Các lệnh thường dùng

| Lệnh | Mô tả |
|------|-------|
| `pnpm dev` | Chạy Backend + Admin song song (Turborepo) |
| `pnpm dev:all` | Chạy TẤT CẢ: Postgres + Backend + Admin + Chatbot |
| `pnpm build` | Build Backend + Admin |
| `pnpm db:migrate` | Chạy Prisma migration |
| `pnpm db:seed` | Seed dữ liệu mẫu |
| `pnpm db:reset` | Reset database |
| `pnpm db:studio` | Mở Prisma Studio |
| `pnpm setup` | Cài deps + generate Prisma client |
| `pnpm clean` | Xóa build artifacts |

## Tài khoản mặc định

| Tài khoản | Mật khẩu | Mô tả |
|-----------|----------|-------|
| `admin` | `admin123` | Admin dashboard |

## API Endpoints

### Auth
- `POST /api/auth/login` — Đăng nhập admin
- `POST /api/auth/refresh` — Refresh token

### Products (JWT required)
- `GET /api/products` — Danh sách sản phẩm
- `GET /api/products/:id` — Chi tiết sản phẩm
- `POST /api/products` — Tạo mới
- `PUT /api/products/:id` — Cập nhật
- `DELETE /api/products/:id` — Xóa mềm
- `PATCH /api/products/:id/stock` — Cập nhật tồn kho

### Categories (JWT required)
- `GET /api/categories` — Danh sách danh mục
- `POST /api/categories` — Tạo mới
- `PUT /api/categories/:id` — Cập nhật
- `DELETE /api/categories/:id` — Xóa mềm

### Orders (JWT required)
- `GET /api/orders` — Danh sách đơn hàng
- `GET /api/orders/:id` — Chi tiết đơn hàng
- `GET /api/orders/code/:code` — Tra cứu theo mã đơn
- `POST /api/orders` — Tạo đơn hàng
- `PATCH /api/orders/:id/status` — Cập nhật trạng thái
- `PATCH /api/orders/:id/cancel` — Hủy đơn

### Bot Internal API (API Key required)
- `GET /api/bot/products` — Tìm kiếm sản phẩm
- `GET /api/bot/products/:id` — Chi tiết sản phẩm
- `GET /api/bot/orders/code/:code` — Tra cứu đơn hàng
- `GET /api/bot/categories` — Danh mục
- `POST /api/bot/chat-sessions` — Quản lý phiên chat

### Stats
- `GET /api/stats/dashboard` — Thống kê dashboard

## Chatbot Webhooks

- `GET/POST /webhooks/zalo` — Zalo OA webhook
- `GET/POST /webhooks/messenger` — Facebook Messenger webhook

## Tech Stack

- **NestJS** — TypeScript strict, Prisma ORM, JWT + API Key auth
- **Next.js 16** — App Router, TailwindCSS v4, TypeScript
- **Python FastAPI** — OpenAI GPT-4o-mini, function calling
- **PostgreSQL 16** — Prisma migrations
- **Turborepo + pnpm** — Monorepo management
- **Docker Compose** — Development environment
