"""Pydantic models for chat messages."""

from typing import Any, Optional
from pydantic import BaseModel, Field


class ChatMessageCreate(BaseModel):
    """Request to save a chat message."""
    role: str = Field(..., pattern=r"^(USER|ASSISTANT|SYSTEM|TOOL)$")
    content: str
    metadata: Optional[dict[str, Any]] = None


class ChatMessageResponse(BaseModel):
    """A chat message from the API."""
    id: str
    sessionId: str
    role: str
    content: str
    metadata: Optional[dict[str, Any]] = None
    createdAt: str
