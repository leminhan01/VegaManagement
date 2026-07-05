# syntax=docker/dockerfile:1.7
# Chatbot: Python 3.11 FastAPI (standalone — not part of the pnpm workspace)
# Build context: repo root.  docker compose build chatbot

# ============ Stage 1: deps ============
FROM python:3.11-slim AS deps
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# Cache layer: install only requirements first (no pytest)
COPY chatbot/requirements.txt ./requirements.txt
RUN --mount=type=cache,id=pip,target=/root/.cache/pip \
    python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip setuptools wheel \
 && /opt/venv/bin/pip install -r requirements.txt

# ============ Stage 2: runtime ============
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app

# Venv already contains fastapi/uvicorn/openai/asyncpg/etc. — no pytest
COPY --from=deps /opt/venv /opt/venv

# Application source (uses intra-package relative imports; __init__.py already present)
COPY chatbot/src ./src

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
