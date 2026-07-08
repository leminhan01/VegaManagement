# 🌿 VegiFlow — Hệ thống quản lý & chatbot cửa hàng thực phẩm chay

Monorepo gồm **4 service** chạy độc lập, giao tiếp qua REST API:

| Service | Công nghệ | Port | Mô tả |
|---------|-----------|------|-------|
| **Backend API** | NestJS + Prisma ORM + PostgreSQL | `3000` | Business logic, CRUD, auth, cung cấp data cho Admin & Chatbot |
| **Admin Panel** | Next.js + TailwindCSS + shadcn/ui | `4000` | Dashboard quản lý cho nhân viên cửa hàng |
| **Landing Page** | Astro | `3001` | Trang khách hàng — xem sản phẩm, giỏ hàng, đặt hàng |
| **Chatbot Service** | Python FastAPI + OpenAI API | `8000` | AI tư vấn qua Web widget, Zalo OA, Facebook Messenger (RAG + function calling) |

**Database:** PostgreSQL 16 + **pgvector** (cho semantic search sản phẩm) — dev dùng DB remote theo `DATABASE_URL`.

## Kiến trúc

```
Khách hàng
  ├─ Web (Landing)  ───────────┐
  ├─ Zalo OA ───── webhook ──┐ │
  └─ Facebook Messenger ───┐ │ │
                          ▼ ▼ ▼
                 ┌──────────────────────┐
                 │  Chatbot (Python)    │  ← OpenAI + pgvector RAG
                 │  :8000               │
                 └──────────┬───────────┘
                            │ HTTP (API Key)
   ┌────────────────────────┼───────────────────────┐
   ▼                        ▼                       ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Landing     │    │  Backend (API)  │    │  Admin Panel     │
│ Astro :3001 │───▶│  NestJS :3000   │◀───│  Next.js :4000   │
└─────────────┘    └────────┬────────┘    └──────────────────┘
                            │ Prisma
                            ▼
                   ┌──────────────────┐
                   │  PostgreSQL 16   │
                   │  + pgvector      │
                   └──────────────────┘
```

## Quick Start

> Yêu cầu: **Node 20+**, **pnpm 10+**, **Python 3.11+**.

### 0. Setup lần đầu

```bash
pnpm install                 # Cài deps cho cả monorepo
pnpm setup                   # Generate Prisma client
pnpm db:migrate              # Chạy migration
pnpm db:seed                 # Seed dữ liệu mẫu
```

Chatbot cần thư viện Python (uvicorn + fastapi + openai...). Khuyến nghị dùng venv:

```bash
cd chatbot
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 1. Chạy tất cả services

```bash
pnpm dev        # Backend + Admin + Landing + Chatbot (cùng lúc)
```

> Lệnh này chạy 4 app service song song và dùng PostgreSQL remote theo `DATABASE_URL`.

```bash
pnpm dev:all    # 4 app service, dùng DB remote trong .env
```

### 2. Chạy từng service riêng

| Lệnh | Service |
|------|---------|
| `pnpm dev:backend` | Backend API → http://localhost:3000 |
| `pnpm dev:admin` | Admin Panel → http://localhost:4000 |
| `pnpm dev:landing` | Landing Page → http://localhost:3001 |
| `pnpm dev:chatbot` | Chatbot Service → http://localhost:8000 |
| `pnpm dev:db` | In ghi chú DB remote dev |

## Các lệnh thường dùng

| Lệnh | Mô tả |
|------|-------|
| `pnpm dev` | Chạy cả 4 app service song song (Turbo + concurrently) |
| `pnpm dev:all` | Như `pnpm dev`, dùng DB remote trong `.env` |
| `pnpm build` | Build Backend + Admin + Landing |
| `pnpm lint` | Lint toàn monorepo |
| `pnpm db:migrate` | Chạy Prisma migration |
| `pnpm db:seed` | Seed dữ liệu mẫu |
| `pnpm db:reset` | Reset database |
| `pnpm db:studio` | Mở Prisma Studio |
| `pnpm setup` | Cài deps + generate Prisma client |
| `pnpm clean` | Xoá build artifacts (`dist`, `.next`, ...) |

## Cấu trúc thư mục

```
Chatbot/
├── backend/      # NestJS API — Auth, Products, Orders, Customers,
│                 #   Categories, Chat-sessions, Bot-api, Storefront,
│                 #   Stats, Email-reports, Inventory, Store-branch, Store-config
├── admin/        # Next.js Admin Panel
├── landing/      # Astro landing page (storefront khách hàng)
├── chatbot/      # Python FastAPI — webhooks + RAG embeddings
├── docker-compose.yml
├── turbo.json    # Turborepo pipeline (dev, build, lint)
└── pnpm-workspace.yaml
```

## Tài khoản mặc định

| Tài khoản | Mật khẩu | Mô tả |
|-----------|----------|-------|
| `admin` | `admin123` | Đăng nhập Admin Panel |

## Biến môi trường

Mỗi service có `.env.example` riêng — copy thành `.env` và điền giá trị:

| Service | File | Các biến chính |
|---------|------|----------------|
| Backend | `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `BOT_API_KEY` |
| Admin | `admin/.env` | `NEXT_PUBLIC_API_URL` |
| Landing | `landing/.env` | API URL của Backend / Chatbot |
| Chatbot | `chatbot/.env` | `OPENAI_API_KEY`, `BACKEND_API_URL`, `BOT_API_KEY`, tokens Zalo/Messenger |

> `BOT_API_KEY` phải **giống nhau** giữa Backend và Chatbot (xác thực internal API).

## Backend API Endpoints

### Auth
- `POST /api/auth/login` — Đăng nhập admin
- `POST /api/auth/refresh` — Refresh token

### Products / Categories (JWT)
- `GET|POST|PUT|DELETE /api/products`, `PATCH /api/products/:id/stock`
- `GET|POST|PUT|DELETE /api/categories`

### Orders / Customers (JWT)
- `GET|POST /api/orders`, `GET /api/orders/:id`, `GET /api/orders/code/:code`, `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/cancel`
- `GET /api/customers`, `GET /api/customers/:id`, `GET /api/customers/:id/orders`

### Storefront / Stats (JWT)
- Storefront APIs cho landing page (sản phẩm, giỏ hàng, đặt hàng)
- `GET /api/stats/dashboard` — Thống kê dashboard

### Bot Internal API (API Key — chỉ cho Chatbot Service)
- `GET /api/bot/products`, `/api/bot/products/:id`, `/api/bot/categories`
- `GET /api/bot/orders/code/:code`
- `POST /api/bot/chat-sessions`, `POST /api/bot/chat-sessions/:id/messages`

## Chatbot Webhooks & APIs

| Endpoint | Mô tả |
|----------|-------|
| `GET/POST /webhooks/web/*` | Web widget chat (landing page) |
| `GET/POST /webhooks/zalo` | Zalo OA webhook |
| `GET/POST /webhooks/messenger` | Facebook Messenger webhook |
| `POST /embeddings/*` | Sync & semantic search sản phẩm (pgvector RAG) |
| `GET /health` | Health check |

## Tech Stack

- **NestJS** — TypeScript strict, Prisma ORM, JWT + API Key auth
- **Next.js** — App Router, TailwindCSS, shadcn/ui
- **Astro** — Landing page storefront
- **Python FastAPI** — OpenAI GPT-4o-mini, function calling, RAG với pgvector
- **PostgreSQL 16 + pgvector** — Prisma migrations + vector embeddings
- **Turborepo + pnpm** — Monorepo management (concurrently cho Chatbot)
- **Docker Compose** — môi trường production

## Docker

```bash
docker compose up -d          # Chạy các services bằng Docker
docker compose logs -f chatbot
docker compose down
```
