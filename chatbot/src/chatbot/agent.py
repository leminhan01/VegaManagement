"""Core chatbot agent — orchestrates OpenAI calls with tool execution."""

import json
import logging
from typing import Any, Optional

from openai import AsyncOpenAI

from ..config import settings
from .tools import TOOLS
from .tool_executor import execute_tool
from .prompts import SYSTEM_PROMPT
from .session import session_manager

logger = logging.getLogger(__name__)

# Max tool call loops to prevent infinite loops
MAX_TOOL_LOOPS = 5


class ChatbotAgent:
    """Handles conversation with OpenAI, including function calling."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL

    async def process_message(
        self,
        platform: str,
        platform_user_id: str,
        user_message: str,
        customer_id: Optional[str] = None,
        guest_phone: Optional[str] = None,
    ) -> dict[str, Any]:
        """Process a user message and return the chatbot response.

        Args:
            platform: "ZALO", "MESSENGER" or "WEB"
            platform_user_id: ID người dùng trên nền tảng
            user_message: The text message from the user
            customer_id: Optional linked customer ID
            guest_phone: Optional phone number

        Returns:
            ``{"text": str, "products": list[dict]}`` — text là phản hồi chứa
            markdown (web render), products là danh sách sản phẩm (để render
            Product Card). Các kênh SMS chỉ dùng ``text`` qua strip markdown.
        """
        try:
            # 1. Get or create session
            session = await session_manager.get_or_create_session(
                platform=platform,
                platform_user_id=platform_user_id,
                customer_id=customer_id,
                guest_phone=guest_phone,
            )
            session_id = session.get("id", "")

            # 2. Save user message
            await session_manager.save_message(session_id, "USER", user_message)

            # 3. Build context
            history = await session_manager.get_history(session_id)
            context = session_manager.build_context(history, user_message)

            # 4. Call OpenAI with tool loop
            response_text, products = await self._call_openai(context)

            # 5. Save assistant message
            await session_manager.save_message(session_id, "ASSISTANT", response_text)

            return {"text": response_text, "products": products}

        except Exception as e:
            logger.error(f"Agent error: {e}", exc_info=True)
            return {
                "text": (
                    "Xin lỗi, tôi đang gặp sự cố kỹ thuật. "
                    "Vui lòng liên hệ hotline hoặc thử lại sau nhé! 🙏"
                ),
                "products": [],
            }

    async def _call_openai(
        self, messages: list[dict[str, Any]]
    ) -> tuple[str, list[dict[str, Any]]]:
        """Call OpenAI API with tool calling loop.

        Keeps calling OpenAI until it returns a text response
        (not a tool call), up to MAX_TOOL_LOOPS iterations.

        Returns:
            ``(response_text, products)`` — products thu thập từ kết quả các
            tool truy vấn sản phẩm trong quá trình gọi.
        """
        system_message = {"role": "system", "content": SYSTEM_PROMPT}
        full_messages = [system_message] + messages

        collected_products: list[dict[str, Any]] = []

        for _ in range(MAX_TOOL_LOOPS):
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,  # type: ignore[arg-type]
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=1000,
            )

            choice = response.choices[0]
            message = choice.message

            # If no tool calls, return the text response
            if not message.tool_calls:
                return (
                    message.content or "Xin lỗi, tôi không thể trả lời ngay lúc này.",
                    collected_products,
                )

            # Process each tool call
            full_messages.append(message)  # type: ignore[arg-type]

            for tool_call in message.tool_calls:
                function_name = tool_call.function.name
                try:
                    function_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    function_args = {}

                logger.info(f"Tool call: {function_name}({function_args})")

                # Execute the tool
                result = await execute_tool(function_name, function_args)

                # Thu thập sản phẩm từ kết quả tool để render Product Card
                collected_products = _merge_products(
                    collected_products, function_name, result
                )

                # Append tool result to messages
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

        # If we exhausted the loop, return a fallback
        return (
            "Xin lỗi, tôi cần thêm thông tin để hỗ trợ bạn. Bạn có thể nói rõ hơn được không?",
            collected_products,
        )


# Các tool trả về dữ liệu sản phẩm (dùng để render Product Card)
_PRODUCT_TOOLS = {
    "search_products",
    "semantic_search_products",
    "get_product_detail",
    "suggest_products",
}
# Giới hạn số Product Card tối đa trả về
MAX_PRODUCT_CARDS = 5


def _merge_products(
    collected: list[dict[str, Any]], tool_name: str, result_str: str
) -> list[dict[str, Any]]:
    """Trích sản phẩm từ JSON kết quả tool, gộp vào danh sách đã thu thập.

    Xử lý nhiều dạng cấu trúc:
    - ``{"data": [...]}`` (search / semantic_search / suggest)
    - ``{"data": {...}}`` (get_product_detail — object đơn)
    - result bản thân là list / object product
    Khử trùng theo ``id``, giữ thứ tự, giới hạn MAX_PRODUCT_CARDS.
    """
    if tool_name not in _PRODUCT_TOOLS or not result_str:
        return collected

    try:
        parsed = json.loads(result_str)
    except (json.JSONDecodeError, TypeError):
        return collected

    # Xác định danh sách product từ cấu trúc kết quả
    if isinstance(parsed, dict):
        data = parsed.get("data")
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = [data]
        else:
            items = [parsed]
    elif isinstance(parsed, list):
        items = parsed
    else:
        return collected

    seen_ids = {p.get("id") for p in collected if p.get("id")}
    for item in items:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        if item["id"] in seen_ids:
            continue
        seen_ids.add(item["id"])
        images = item.get("images") or []
        image = images[0] if isinstance(images, list) and images else None
        collected.append({
            "id": item.get("id"),
            "name": item.get("name"),
            "price": item.get("price"),
            "sale_price": item.get("salePrice"),
            "image": image,
            "slug": item.get("slug"),
            "short_desc": item.get("shortDesc"),
        })
        if len(collected) >= MAX_PRODUCT_CARDS:
            break

    return collected
