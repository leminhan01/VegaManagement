# syntax=docker/dockerfile:1.7
# Landing: Astro static build served by nginx
# Build context: repo root.

# ============ Stage 1: build ============
FROM node:20-slim AS build
ENV CI=1

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY admin/package.json   ./admin/
COPY landing/package.json ./landing/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY landing/ ./landing/
ARG PUBLIC_CHATBOT_API_URL=http://localhost:8000
ENV PUBLIC_CHATBOT_API_URL=$PUBLIC_CHATBOT_API_URL
RUN pnpm --filter landing build          # Astro emits -> landing/dist

# ============ Stage 2: serve ============
FROM nginx:alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
# Path is landing/nginx.conf because context == repo root
COPY landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/landing/dist /usr/share/nginx/html
EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
