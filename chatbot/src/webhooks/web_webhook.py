"""Web chat webhook handler — receive and process messages from web client."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..chatbot.agent import ChatbotAgent
from ..clients.backend_api import backend_api

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/web", tags=["Web Chat"])

agent = ChatbotAgent()

WELCOME_MESSAGE = (
    "🌿 Chào mừng bạn đến với VegiFlow - Cửa hàng thực phẩm chay online!\n\n"
    "Em có thể giúp gì cho bạn ạ?\n"
    "• Tư vấn sản phẩm\n"
    "• Tra cứu đơn hàng\n"
    "• Xem danh mục sản phẩm\n"
    "• Thông tin cửa hàng"
)


# ── Request / Response Models ──────────────────────────────────

class WebChatRequest(BaseModel):
    """Incoming chat message from web client."""
    session_id: Optional[str] = Field(
        default=None,
        description="ID phiên chat. Bỏ trống để tạo session mới.",
    )
    content: str = Field(description="Nội dung tin nhắn")
    customer_id: Optional[str] = Field(
        default=None,
        description="ID khách hàng (nếu đã đăng nhập)",
    )


class WebChatResponse(BaseModel):
    """Response from chatbot."""
    reply: str
    session_id: str
    timestamp: str
    intent: Optional[str] = None


class NewSessionResponse(BaseModel):
    """Response when creating a new session."""
    session_id: str
    welcome_message: str


class ChatHistoryMessage(BaseModel):
    """Single message in chat history."""
    id: str
    role: str
    content: str
    created_at: str


class ChatHistoryResponse(BaseModel):
    """Chat history for a session."""
    session_id: str
    messages: list[ChatHistoryMessage]
    is_active: bool


# ── Helper ─────────────────────────────────────────────────────

async def _get_or_create_web_session(
    session_id: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> dict[str, Any]:
    """Get existing session or create new WEB session."""
    if session_id:
        try:
            # Verify session exists
            messages = await backend_api.get_session_messages(session_id)
            return {"id": session_id, "messages": messages}
        except Exception:
            logger.warning(f"Session {session_id} not found, creating new one")

    # Create new session with unique platform user ID
    platform_user_id = f"web_{uuid.uuid4().hex[:12]}"
    result = await backend_api.upsert_session({
        "platform": "WEB",
        "platformUserId": platform_user_id,
        "customerId": customer_id,
        "isActive": True,
    })
    session = result.get("data", result)
    return session


# ── Endpoints ──────────────────────────────────────────────────

@router.post("/chat/new", response_model=NewSessionResponse)
async def create_new_session(
    customer_id: Optional[str] = None,
):
    """Tạo phiên chat mới."""
    platform_user_id = f"web_{uuid.uuid4().hex[:12]}"
    result = await backend_api.upsert_session({
        "platform": "WEB",
        "platformUserId": platform_user_id,
        "customerId": customer_id,
        "isActive": True,
    })
    session = result.get("data", result)

    # Lưu tin nhắn chào mừng
    await backend_api.save_message(session["id"], {
        "role": "ASSISTANT",
        "content": WELCOME_MESSAGE,
    })

    return NewSessionResponse(
        session_id=session["id"],
        welcome_message=WELCOME_MESSAGE,
    )


@router.post("/chat", response_model=WebChatResponse)
async def handle_web_chat(request: WebChatRequest):
    """Nhận tin nhắn từ web client và trả lời bằng AI.

    Luồng xử lý:
    1. Tạo/tìm session (WEB platform)
    2. Gửi tin nhắn đến AI agent
    3. Agent phân loại intent → chọn tool phù hợp (RAG search, store info, v.v.)
    4. Trả về phản hồi
    """
    # 1. Get or create session
    if request.session_id:
        # Session đã có — gọi agent trực tiếp với platform_user_id từ session
        session_id = request.session_id
        # Cần lấy platform_user_id từ session để agent dùng
        try:
            messages = await backend_api.get_session_messages(session_id)
            # platform_user_id không có trong messages, dùng session_id thay thế
            platform_user_id = f"web_session_{session_id[:8]}"
        except Exception:
            raise HTTPException(status_code=404, detail="Session không tồn tại")
    else:
        # Tạo session mới
        platform_user_id = f"web_{uuid.uuid4().hex[:12]}"
        result = await backend_api.upsert_session({
            "platform": "WEB",
            "platformUserId": platform_user_id,
            "customerId": request.customer_id,
            "isActive": True,
        })
        session = result.get("data", result)
        session_id = session["id"]

    # 2. Process message with AI agent
    response_text = await agent.process_message(
        platform="WEB",
        platform_user_id=platform_user_id,
        user_message=request.content,
        customer_id=request.customer_id,
    )

    # 3. Return response
    return WebChatResponse(
        reply=response_text,
        session_id=session_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/chat/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(session_id: str):
    """Lấy lịch sử chat cho một session."""
    try:
        messages_raw = await backend_api.get_session_messages(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    messages = []
    for msg in messages_raw:
        messages.append(ChatHistoryMessage(
            id=msg.get("id", ""),
            role=msg.get("role", "user").lower(),
            content=msg.get("content", ""),
            created_at=msg.get("createdAt", ""),
        ))

    return ChatHistoryResponse(
        session_id=session_id,
        messages=messages,
        is_active=True,
    )
