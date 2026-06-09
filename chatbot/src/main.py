"""VegiFlow Chatbot Service — FastAPI application."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .clients.backend_api import backend_api
from .embeddings.service import embedding_service
from .embeddings.router import router as embeddings_router
from .webhooks.zalo_webhook import router as zalo_router
from .webhooks.messenger_webhook import router as messenger_router
from .webhooks.web_webhook import router as web_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info(f"🤖 VegiFlow Chatbot Service starting on port {settings.PORT}")
    logger.info(f"   Backend API: {settings.BACKEND_API_URL}")
    logger.info(f"   OpenAI Model: {settings.OPENAI_MODEL}")
    logger.info(f"   Embedding Model: {settings.OPENAI_EMBEDDING_MODEL}")
    yield
    # Cleanup
    await backend_api.close()
    await embedding_service.close()
    logger.info("Chatbot service shutting down")


app = FastAPI(
    title="VegiFlow Chatbot Service",
    description="AI-powered chatbot for vegetarian food store — Web / Zalo OA / Facebook Messenger",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes FIRST (before static files)
app.include_router(zalo_router)
app.include_router(messenger_router)
app.include_router(web_router)
app.include_router(embeddings_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "vegiflow-chatbot",
        "version": "2.0.0",
    }


# Serve static files (landing page) — mount LAST so API routes take priority
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    logger.info(f"   Static files: {static_dir}")
