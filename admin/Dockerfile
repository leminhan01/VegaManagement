# syntax=docker/dockerfile:1.7
# Admin: Next.js 16.2.7 standalone
# Build context: repo root.  Requires output:'standalone' in admin/next.config.ts.

# ============ Stage 1: build ============
FROM node:20-slim AS build
# Do NOT set NODE_ENV=development here — Next.js's `next build` requires production mode
# and will fail SSR prerender ("Cannot read properties of null (reading 'useContext')")
# if NODE_ENV is overridden to anything else.
ENV CI=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo

# Layer A: manifests + lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY admin/package.json   ./admin/
COPY landing/package.json ./landing/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# NEXT_PUBLIC_* are BUILD-TIME vars (Next inlines them into the bundle, not read at runtime).
# .dockerignore excludes .env, so they must be passed via ARG.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_APP_NAME=VegiFlow Admin
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Layer B: source + build (next build sets NODE_ENV=production internally)
COPY admin/ ./admin/
RUN pnpm --filter admin build
# Outputs:
#   /repo/admin/.next/standalone/   (server.js + minimal node_modules)
#   /repo/admin/.next/static/       (JS/CSS/images)
#   /repo/admin/public/             (static assets, served as-is)

# ============ Stage 2: runtime ============
FROM node:20-slim AS runtime
ENV NODE_ENV=production PORT=4000 HOSTNAME=0.0.0.0
WORKDIR /app

# Next 16 standalone preserves the workspace-relative path, so server.js lives at
# admin/server.js (not /app/server.js). Static + public resolve relative to cwd (/app).
COPY --from=build /repo/admin/.next/standalone ./
COPY --from=build /repo/admin/.next/static ./.next/static
COPY --from=build /repo/admin/public ./public

EXPOSE 4000
CMD ["node", "admin/server.js"]
