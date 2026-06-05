"""Zalo OA webhook handler — receive and process Zalo events."""

import logging
from typing import Any

from fastapi import APIRouter, Query, Request

from ..config import settings
from ..chatbot.agent import ChatbotAgent
from ..clients.zalo_client import zalo_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/zalo", tags=["Zalo Webhook"])

agent = ChatbotAgent()

WELCOME_MESSAGE = (
    "🌿 Chào mừng bạn đến với VegiFlow — Cửa hàng thực phẩm chay online!\n\n"
    "Em có thể giúp gì cho bạn ạ?\n"
    "• Tư vấn sản phẩm\n"
    "• Tra cứu đơn hàng\n"
    "• Xem danh mục sản phẩm"
)

IMAGE_REPLY = "Cảm ơn bạn đã gửi hình ảnh! Hiện tại em chưa hỗ trợ xử lý ảnh, bạn có thể mô tả bằng văn bản nhé! 📝"


@router.get("")
async def verify_zalo_webhook(
    verify_token: str = Query("", alias="verify_token"),
    challenge: str = Query("", alias="challenge"),
):
    """Verify Zalo webhook (challenge response)."""
    if verify_token == settings.ZALO_WEBHOOK_VERIFY_TOKEN:
        return {"challenge": challenge}
    return {"error": "Invalid verify token"}


@router.post("")
async def handle_zalo_webhook(request: Request):
    """Receive and process events from Zalo OA."""
    try:
        body = await request.json()
        event_name = body.get("event_name", "")
        logger.info(f"Zalo webhook event: {event_name}")

        # User sends text message
        if event_name == "user_send_text":
            message_data = body.get("message", {})
            sender = message_data.get("sender", {})
            user_id = sender.get("id", "")
            message_text = message_data.get("message", {}).get("text", "")

            if not user_id or not message_text:
                return {"status": "ok"}

            logger.info(f"Zalo message from {user_id}: {message_text[:100]}")

            # Process with AI agent
            response = await agent.process_message(
                platform="ZALO",
                platform_user_id=user_id,
                user_message=message_text,
            )

            # Send response back via Zalo
            await zalo_client.send_text(user_id, response)
            return {"status": "ok"}

        # User sends image
        elif event_name == "user_send_image":
            message_data = body.get("message", {})
            sender = message_data.get("sender", {})
            user_id = sender.get("id", "")

            if user_id:
                await zalo_client.send_text(user_id, IMAGE_REPLY)
            return {"status": "ok"}

        # User follows the OA
        elif event_name == "follow":
            message_data = body.get("message", {})
            sender = message_data.get("sender", {})
            user_id = sender.get("id", "")

            if user_id:
                await zalo_client.send_text(user_id, WELCOME_MESSAGE)
            return {"status": "ok"}

        # Sticker or other events
        else:
            logger.info(f"Unhandled Zalo event: {event_name}")
            return {"status": "ok"}

    except Exception as e:
        logger.error(f"Zalo webhook error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
