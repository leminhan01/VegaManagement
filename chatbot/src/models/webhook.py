"""Pydantic models for webhook payloads."""

from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Zalo Webhook Models ──

class ZaloMessage(BaseModel):
    """A message from Zalo user."""
    text: str = ""


class ZaloSender(BaseModel):
    """Zalo sender info."""
    id: str


class ZaloEventMessage(BaseModel):
    """Zalo event with message."""
    sender: ZaloSender
    message: ZaloMessage


class ZaloWebhookEvent(BaseModel):
    """Top-level Zalo OA webhook event."""
    event_name: str
    message: Optional[ZaloEventMessage] = None


# ── Messenger Webhook Models ──

class MessengerSender(BaseModel):
    """Messenger sender info."""
    id: str  # PSID


class MessengerMessage(BaseModel):
    """A message from Messenger user."""
    mid: str = ""
    text: str = ""


class MessengerMessaging(BaseModel):
    """A single messaging event."""
    sender: MessengerSender
    recipient: MessengerSender
    message: Optional[MessengerMessage] = None
    postback: Optional[dict[str, Any]] = None


class MessengerEntry(BaseModel):
    """An entry in the webhook payload."""
    id: str
    time: int = 0
    messaging: list[MessengerMessaging] = Field(default_factory=list)


class MessengerWebhookEvent(BaseModel):
    """Top-level Messenger webhook event."""
    object: str = ""
    entry: list[MessengerEntry] = Field(default_factory=list)


# ── Session Models ──

class SessionUpsert(BaseModel):
    """Create or update a chat session."""
    platform: str = Field(..., pattern=r"^(ZALO|MESSENGER)$")
    platformUserId: str
    customerId: Optional[str] = None
    guestPhone: Optional[str] = None
    isActive: Optional[bool] = True
