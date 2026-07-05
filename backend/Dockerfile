# syntax=docker/dockerfile:1.7
# Backend: NestJS 11 + Prisma 7 (driver-adapter mode)
# Build context: repo root.  docker compose build backend

# ============ Stage 1: build ============
FROM node:20-slim AS build
ENV CI=1

# openssl: required by @prisma/engines for migrate/introspect.
# ca-certificates: TLS to the remote VPS database.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Pin pnpm to exactly the version declared in root package.json
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo

# Layer A (cached on lockfile/manifest changes only):
# copy root lockfile + workspace manifests for ALL workspace packages
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY admin/package.json   ./admin/
COPY landing/package.json ./landing/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Layer B: prisma generate MUST run before nest build.
# Prisma 7 emits TypeScript into backend/src/generated/prisma/ which nest compiles into dist/.
# Running install+generate here (on linux/amd64) fetches the correct @prisma/engines binary
# for the target runtime platform — do NOT move generate into a local dev step.
COPY backend/prisma ./backend/prisma
RUN pnpm --filter backend exec prisma generate

# Layer C: source + compile
COPY backend/ ./backend/
RUN pnpm --filter backend build           # -> backend/dist/src/main.js (+ dist/src/generated/prisma)

# Layer D: produce a pruned production deployment.
# --legacy is required in pnpm v10+ (deploy otherwise needs inject-workspace-packages=true).
# pnpm deploy materialises a self-contained dir with PROD node_modules only (no prisma CLI,
# no jest, no typescript). We then force-copy the freshly built dist/ over whatever deploy
# included (deploy may exclude dist/ via the package's .gitignore defaults).
RUN pnpm deploy --filter=backend --prod --legacy /deploy \
 && rm -rf /deploy/dist \
 && cp -r backend/dist /deploy/dist

# Layer E: pnpm deploy REINSTALLS prod deps fresh, so @prisma/client in /deploy is UNGENERATED
# (the generate done in Layer B patched /repo/node_modules, which deploy discards).
# Re-run prisma generate targeting /deploy/node_modules by placing the schema inside /deploy.
# Uses the build stage's prisma CLI so the CLI (a devDep) stays OUT of the runtime image.
# Prisma resolves the output node_modules by walking up from the schema file's directory.
RUN cp -r backend/prisma /deploy/prisma \
 && pnpm --filter backend exec prisma generate --schema=/deploy/prisma/schema.prisma \
 && rm -rf /deploy/prisma

# ============ Stage 2: runtime ============
FROM node:20-slim AS runtime
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# /deploy contains: package.json, node_modules (prod), dist/
COPY --from=build /deploy ./

# Mountpoint for the uploads volume (compose mounts ./backend/uploads here)
RUN mkdir -p /app/uploads

EXPOSE 3000
# init:true in compose handles PID-1 / signal forwarding
CMD ["node", "dist/src/main.js"]
