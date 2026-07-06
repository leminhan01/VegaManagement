# Deploy Guide — CI/CD via GitHub Actions + GHCR

Pipeline (`.github/workflows/build.yml`):
1. **Push lên `main`** → build song song 4 image (backend, admin, chatbot, landing).
2. Push lên `ghcr.io/leminhan01/vegiflow-<service>` với 2 tag: `:latest` và `:sha-xxxxxxx`.
3. **Deploy**: copy `docker-compose.prod.yml` sang VPS qua SCP, rồi SSH `pull && up -d`.

> Build-args (URL public) mặc định dùng subdomain đề xuất, override được qua
> **GitHub repo Variables** (không phải Secrets vì không nhạy cảm).

---

## 0. Kiến trúc subdomain (đề xuất cho `lmnhan.io.vn`)

| Subdomain | Service | Container (trên network `proxy`) |
|---|---|---|
| `api.lmnhan.io.vn`     | backend API  | `http://backend:3000`   |
| `admin.lmnhan.io.vn`   | admin panel  | `http://admin:4000`     |
| `bot.lmnhan.io.vn`     | chatbot      | `http://chatbot:8000`   |
| `lmnshop.lmnhan.io.vn` | landing      | `http://landing:80`     |

Tất cả qua **Nginx Proxy Manager** (NPM) — terminate SSL (Let's Encrypt) rồi route
tới tên container trong network `proxy` chung.

---

## 1. Chuẩn bị VPS (chạy 1 lần)

```bash
# SSH vào VPS
ssh deploy@180.93.54.119

# Cài Docker + Docker Compose plugin nếu chưa có
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # rồi login lại

# Clone repo (chỉ cần để có chỗ đặt compose + .env; deploy sẽ copy compose tự động)
git clone https://github.com/leminhan01/VegaManagement.git ~/VegaManagement
cd ~/VegaManagement

# Tạo network chung cho NPM
docker network create proxy

# (Tuỳ chọn) Login GHCR nếu image PRIVATE — nếu public thì bỏ qua
echo "<GITHUB_PAT_read:packages>" | docker login ghcr.io -u leminhan01 --password-stdin
```

### Đặt file `.env` lên VPS (KHÔNG commit — đã gitignore)

Tạo 3 file tại `~/VegaManagement/`:

**`backend/.env`** — quan trọng nhất:
```env
NODE_ENV=production
# Container chạy trên VPS → kết nối Postgres của host qua bridge gateway
DATABASE_URL=postgresql://veg_user:admin123@host.docker.internal:5432/veg_shop
JWT_SECRET=<strong-secret>
CUSTOMER_JWT_SECRET=<strong-secret>
BOT_API_KEY=<api-key-bcrypt-dùng>
CHATBOT_SERVICE_URL=http://chatbot:8000     # bị compose override, ghi cho đủ
CLOUDINARY_URL=cloudinary://...
# SMTP, etc. (copy từ backend/.env local, đổi giá trị prod nếu cần)
```

**`chatbot/.env`**: copy từ `chatbot/.env` local, đảm bảo có `OPENAI_API_KEY`,
`DATABASE_URL=postgresql://veg_user:admin123@host.docker.internal:5432/veg_shop`,
`BOT_API_KEY` (trùng backend), và các biến Zalo/Messenger.

**`admin/.env`**: biến runtime (nếu có); `NEXT_PUBLIC_*` không cần vì đã nhúng lúc build.

### Yêu cầu Postgres trên VPS
- `listen_addresses` bao gồm `0.0.0.0` hoặc interface docker bridge.
- Firewall cho phép subnet docker (`172.16.0.0/12`) tới 5432 — **không mở 5432 ra Internet**.
- Migration (chạy 1 lần + mỗi lần thêm migration):
  ```bash
  DATABASE_URL=postgresql://veg_user:admin123@localhost:5432/veg_shop \
    pnpm --filter backend exec prisma migrate deploy
  ```

---

## 2. Thiết lập GitHub Secrets & Variables

Vào repo **Settings → Secrets and variables → Actions**.

### Secrets (bắt buộc cho deploy)

| Tên | Giá trị | Ghi chú |
|---|---|---|
| `VPS_HOST` | `180.93.54.119` | IP VPS |
| `VPS_USER` | `deploy` | user SSH |
| `VPS_PORT` | `22` | (hoặc port SSH của bạn) |
| `VPS_SSH_KEY` | nội dung private key | sinh bằng `ssh-keygen`, public key thêm vào `~/.ssh/authorized_keys` của user `deploy` trên VPS. Phải bắt đầu bằng `-----BEGIN OPENSSH PRIVATE KEY-----` và kết thúc bằng `-----END ...-----` |
| `GHCR_PAT` | GitHub PAT `read:packages` | **bỏ qua nếu đặt image public** |
| `GHCR_USER` | `leminhan01` | **bỏ qua nếu public** |

> Sinh SSH key cho CI: `ssh-keygen -t ed25519 -f ~/.ssh/gh_actions_deploy -N ""`
> rồi paste nội dung file `gh_actions_deploy` vào secret `VPS_SSH_KEY`.
> Copy file `.pub` vào `/home/deploy/.ssh/authorized_keys` trên VPS.

### Variables (URL public — không nhạy cảm, optional)

| Tên | Mặc định (nếu không set) |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.lmnhan.io.vn/api` |
| `PUBLIC_CHATBOT_API_URL` | `https://bot.lmnhan.io.vn` |
| `PUBLIC_STOREFRONT_API_URL` | `https://api.lmnhan.io.vn/api` |

Chỉ set nếu đổi subdomain.

---

## 3. Đặt image GHCR là public (đơn giản nhất)

Sau lần push `main` đầu tiên, vào profile → tab **Packages** → `vegiflow-*` →
**Package settings → Change visibility → Public**. Khi đó VPS pull không cần PAT,
bạn có thể bỏ `GHCR_PAT`/`GHCR_USER` (workflow tự skip login nếu secret rỗng).

---

## 4. Cấu hình Nginx Proxy Manager (chạy 1 lần)

Chạy NPM trên VPS, join network `proxy`:
```yaml
# /home/deploy/npm/docker-compose.yml
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    ports: ["80:80", "81:81", "443:443"]
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks: [proxy]
networks:
  proxy:
    external: true
```

Vào NPM UI (`http://180.93.54.119:81`, admin@example.com / changeme → đổi pass),
tạo **Proxy Host** cho mỗi subdomain:

| Domain | Forward Hostname | Port | SSL |
|---|---|---|---|
| `api.lmnhan.io.vn`     | `backend`   | 3000 | Request SSL (Let's Encrypt) |
| `admin.lmnhan.io.vn`   | `admin`     | 4000 | Request SSL |
| `bot.lmnhan.io.vn`     | `chatbot`   | 8000 | Request SSL |
| `lmnshop.lmnhan.io.vn` | `landing`   | 80   | Request SSL |

> Forward Hostname = **tên container** (chỉ hoạt động nếu cả NPM và app cùng
> network `proxy`). Bật "Block Common Exploits" + "Websockets Support".

### DNS record (ở nơi quản lý `lmnhan.io.vn`)
Trỏ 4 record (A hoặc CNAME) về `180.93.54.119`:
- `api`, `admin`, `bot`, `lmnshop` → A → `180.93.54.119`

---

## 5. Deploy

Chỉ cần:
```bash
git push origin main        # trigger CI + auto deploy
```

Hoặc chạy thủ công: tab **Actions → Build and Push → Run workflow**.

Theo dõi: **Actions** tab. Sau khi job `deploy` xanh, kiểm tra trên VPS:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Test: `curl https://api.lmnhan.io.vn/api/bot/products -H "x-api-key: <key>"` → HTTP 200.

---

## 6. Rollback

Mỗi image có tag `:sha-xxxxxxx` (short commit). Rollback về commit cũ:
```bash
# Trên VPS
cd ~/VegaManagement
IMAGE_TAG=sha-<old-short-sha> docker compose -f docker-compose.prod.yml up -d
```
(vì compose dùng `${IMAGE_TAG:-latest}`, override bằng env là xong.)

---

## 7. Lưu ý quan trọng

- **Secret `.env`**: KHÔNG bao giờ commit. Trên VPS đặt tại `<VPS_PATH>/backend/.env`,
  `<VPS_PATH>/chatbot/.env`. Workflow chỉ copy `docker-compose.prod.yml`.
- **`docker-compose.override.yml`** (local dev) đã gitignore → không ảnh hưởng prod.
- **Migration**: workflow KHÔNG chạy migrate (giữ image nhỏ, tránh race). Chạy thủ công
  mỗi khi thêm migration (mục 1).
- **Build-args đổi URL**: sửa repo Variable (không cần sửa code/workflow), push lại `main`.
