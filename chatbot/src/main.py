"""VegiFlow Chatbot Service — FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .clients.backend_api import backend_api
from .webhooks.zalo_webhook import router as zalo_router
from .webhooks.messenger_webhook import router as messenger_router

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
    yield
    # Cleanup
    await backend_api.close()
    logger.info("Chatbot service shutting down")


app = FastAPI(
    title="VegiFlow Chatbot Service",
    description="AI-powered chatbot for vegetarian food store — Zalo OA & Facebook Messenger",
    version="1.0.0",
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

# Register webhook routes
app.include_router(zalo_router)
app.include_router(messenger_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "vegiflow-chatbot",
        "version": "1.0.0",
    }
