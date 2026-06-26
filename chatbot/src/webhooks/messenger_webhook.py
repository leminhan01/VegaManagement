"""Facebook Messenger webhook handler — receive and process Messenger events."""

import logging

from fastapi import APIRouter, Query, Request, Response

from ..config import settings
from ..chatbot.agent import ChatbotAgent
from ..chatbot.markdown_utils import strip_markdown_for_sms
from ..clients.messenger_client import messenger_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/messenger", tags=["Messenger Webhook"])

agent = ChatbotAgent()

WELCOME_MESSAGE = (
    "🌿 Chào mừng bạn đến với VegiFlow — Cửa hàng thực phẩm chay online!\n\n"
    "Em có thể giúp gì cho bạn ạ?\n"
    "• Tư vấn sản phẩm\n"
    "• Tra cứu đơn hàng\n"
    "• Xem danh mục sản phẩm"
)


@router.get("")
async def verify_messenger_webhook(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
    hub_challenge: str = Query("", alias="hub.challenge"),
):
    """Verify Messenger webhook — respond with hub.challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.FB_WEBHOOK_VERIFY_TOKEN:
        logger.info("Messenger webhook verified")
        return Response(content=hub_challenge, media_type="text/plain")
    return Response(content="Forbidden", status_code=403)


@router.post("")
async def handle_messenger_webhook(request: Request):
    """Receive and process events from Facebook Messenger."""
    try:
        body = await request.json()

        # Verify this is a page subscription
        if body.get("object") != "page":
            return {"status": "ignored"}

        for entry in body.get("entry", []):
            for messaging_event in entry.get("messaging", []):
                sender_id = messaging_event.get("sender", {}).get("id", "")
                recipient_id = messaging_event.get("recipient", {}).get("id", "")

                # Skip echoes (messages sent by the page itself)
                if sender_id == settings.FB_PAGE_ID:
                    continue

                # Handle text messages
                message = messaging_event.get("message", {})
                message_text = message.get("text", "")
                is_echo = message.get("is_echo", False)

                if is_echo:
                    continue

                if message_text and sender_id:
                    logger.info(f"Messenger message from {sender_id}: {message_text[:100]}")

                    # Process with AI agent
                    result = await agent.process_message(
                        platform="MESSENGER",
                        platform_user_id=sender_id,
                        user_message=message_text,
                    )

                    # Send response back via Messenger (không render markdown → strip)
                    await messenger_client.send_text(
                        sender_id, strip_markdown_for_sms(result["text"])
                    )

                # Handle postbacks (Get Started button, etc.)
                elif messaging_event.get("postback"):
                    payload = messaging_event["postback"].get("payload", "")
                    if payload == "GET_STARTED" and sender_id:
                        await messenger_client.send_text(sender_id, WELCOME_MESSAGE)

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Lỗi webhook Messenger: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
