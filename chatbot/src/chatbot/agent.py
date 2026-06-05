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
    ) -> str:
        """Process a user message and return the chatbot response.

        Args:
            platform: "ZALO" or "MESSENGER"
            platform_user_id: ID người dùng trên nền tảng
            user_message: The text message from the user
            customer_id: Optional linked customer ID
            guest_phone: Optional phone number

        Returns:
            The chatbot's text response
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
            response_text = await self._call_openai(context)

            # 5. Save assistant message
            await session_manager.save_message(session_id, "ASSISTANT", response_text)

            return response_text

        except Exception as e:
            logger.error(f"Agent error: {e}", exc_info=True)
            return (
                "Xin lỗi, tôi đang gặp sự cố kỹ thuật. "
                "Vui lòng liên hệ hotline hoặc thử lại sau nhé! 🙏"
            )

    async def _call_openai(self, messages: list[dict[str, Any]]) -> str:
        """Call OpenAI API with tool calling loop.

        Keeps calling OpenAI until it returns a text response
        (not a tool call), up to MAX_TOOL_LOOPS iterations.
        """
        system_message = {"role": "system", "content": SYSTEM_PROMPT}
        full_messages = [system_message] + messages

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
                return message.content or "Xin lỗi, tôi không thể trả lời ngay lúc này."

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

                # Append tool result to messages
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

        # If we exhausted the loop, return a fallback
        return "Xin lỗi, tôi cần thêm thông tin để hỗ trợ bạn. Bạn có thể nói rõ hơn được không?"
