"""Zalo OA API client — send messages to users via Zalo."""

import logging
from typing import Any, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

ZALO_API_BASE = "https://openapi.zalo.me/v3.0/oa/message"


class ZaloClient:
    """Client for sending messages through Zalo OA API."""

    def __init__(self) -> None:
        self.oa_id = settings.ZALO_OA_ID
        self.access_token = settings.ZALO_OA_ACCESS_TOKEN

    async def _send_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send a request to Zalo OA API."""
        headers = {
            "access_token": self.access_token,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(ZALO_API_BASE, json=payload, headers=headers)
            res.raise_for_status()
            return res.json()

    async def send_text(self, user_id: str, message: str) -> dict[str, Any]:
        """Send a text message to a Zalo user."""
        payload = {
            "recipient": {"user_id": user_id},
            "message": {"text": message},
        }
        try:
            return await self._send_request(payload)
        except Exception as e:
            logger.error(f"Zalo send_text error: {e}")
            return {"error": str(e)}

    async def send_attachment(
        self, user_id: str, image_url: str, message: str = ""
    ) -> dict[str, Any]:
        """Send an image attachment to a Zalo user."""
        payload = {
            "recipient": {"user_id": user_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "elements": [
                            {
                                "media_url": image_url,
                                "description": message,
                            }
                        ]
                    },
                }
            },
        }
        try:
            return await self._send_request(payload)
        except Exception as e:
            logger.error(f"Zalo send_attachment error: {e}")
            return {"error": str(e)}

    async def send_quick_reply(
        self, user_id: str, message: str, options: list[str]
    ) -> dict[str, Any]:
        """Send a message with quick reply buttons."""
        attachments = [
            {"title": opt, "type": "quick_reply", "payload": {"action": opt}}
            for opt in options
        ]
        payload = {
            "recipient": {"user_id": user_id},
            "message": {
                "text": message,
                "attachment": attachments,
            },
        }
        try:
            return await self._send_request(payload)
        except Exception as e:
            logger.error(f"Zalo send_quick_reply error: {e}")
            return {"error": str(e)}


zalo_client = ZaloClient()
