"""Facebook Messenger API client — send messages to users."""

import hashlib
import hmac
import logging
from typing import Any, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

MESSENGER_API_BASE = "https://graph.facebook.com/v21.0"


class MessengerClient:
    """Client for sending messages through Facebook Messenger API."""

    def __init__(self) -> None:
        self.page_id = settings.FB_PAGE_ID
        self.page_access_token = settings.FB_PAGE_ACCESS_TOKEN
        self.app_secret = settings.FB_APP_SECRET

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify the X-Hub-Signature header from Messenger webhooks."""
        if not self.app_secret:
            return True  # Skip if no app secret configured
        expected = "sha1=" + hmac.new(
            self.app_secret.encode(), payload, hashlib.sha1
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def _send_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send a request to Messenger Send API."""
        url = f"{MESSENGER_API_BASE}/{self.page_id}/messages"
        params = {"access_token": self.page_access_token}
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload, params=params)
            res.raise_for_status()
            return res.json()

    async def send_text(self, psid: str, message: str) -> dict[str, Any]:
        """Send a text message to a Messenger user."""
        payload = {
            "recipient": {"id": psid},
            "message": {"text": message},
        }
        try:
            return await self._send_request(payload)
        except Exception as e:
            logger.error(f"Messenger send_text error: {e}")
            return {"error": str(e)}

    async def send_quick_replies(
        self, psid: str, text: str, replies: list[dict[str, str]]
    ) -> dict[str, Any]:
        """Send a message with quick reply buttons.

        Args:
            psid: Page-scoped user ID
            text: The message text
            replies: List of {"title": "...", "payload": "..."} dicts
        """
        quick_replies = [
            {
                "content_type": "text",
                "title": r["title"],
                "payload": r.get("payload", r["title"]),
            }
            for r in replies
        ]
        payload = {
            "recipient": {"id": psid},
            "message": {"text": text, "quick_replies": quick_replies},
        }
        try:
            return await self._send_request(payload)
        except Exception as e:
            logger.error(f"Messenger send_quick_replies error: {e}")
            return {"error": str(e)}

    async def send_generic_template(
        self, psid: str, elements: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Send a generic template (product carousel)."""
        payload = {
            "recipient": {"id": psid},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": elements[:10],  # Max 10 elements
                    },
                }
            },
        }
        try:
            return await self._send_request(payload)
        except Exception as e:
            logger.error(f"Messenger send_generic_template error: {e}")
            return {"error": str(e)}


messenger_client = MessengerClient()
