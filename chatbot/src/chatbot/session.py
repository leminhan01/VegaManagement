"""Chat session management — delegates to backend API."""

import logging
from typing import Any, Optional

from ..clients.backend_api import backend_api
from ..config import settings

logger = logging.getLogger(__name__)

# Max messages to include in context (fit token limits)
MAX_CONTEXT_MESSAGES = 20


class SessionManager:
    """Manages chat sessions via the NestJS Bot API."""

    async def get_or_create_session(
        self,
        platform: str,
        platform_user_id: str,
        customer_id: Optional[str] = None,
        guest_phone: Optional[str] = None,
    ) -> dict[str, Any]:
        """Get existing session or create new one via upsert."""
        try:
            result = await backend_api.upsert_session({
                "platform": platform,
                "platformUserId": platform_user_id,
                "customerId": customer_id,
                "guestPhone": guest_phone,
                "isActive": True,
            })
            return result.get("data", result)
        except Exception as e:
            logger.error(f"Failed to get/create session: {e}")
            raise

    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """Save a message to the session."""
        try:
            await backend_api.save_message(session_id, {
                "role": role,
                "content": content,
                "metadata": metadata,
            })
        except Exception as e:
            logger.error(f"Không lưu được tin nhắn: {e}")

    async def get_history(self, session_id: str) -> list[dict[str, Any]]:
        """Get chat history for context building."""
        try:
            messages = await backend_api.get_session_messages(session_id)
            # Take only the most recent messages
            return messages[-MAX_CONTEXT_MESSAGES:]
        except Exception as e:
            logger.error(f"Failed to get history: {e}")
            return []

    def build_context(
        self,
        history: list[dict[str, Any]],
        user_message: str,
    ) -> list[dict[str, Any]]:
        """Build OpenAI messages array from history + new user message."""
        messages: list[dict[str, Any]] = []

        for msg in history:
            role = msg.get("role", "user").lower()
            if role in ("user", "assistant"):
                messages.append({
                    "role": role,
                    "content": msg.get("content", ""),
                })

        # Append current user message
        messages.append({"role": "user", "content": user_message})

        return messages


# Singleton
session_manager = SessionManager()
