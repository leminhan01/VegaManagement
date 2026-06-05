"""Map OpenAI tool calls to backend API methods."""

import json
import logging
from typing import Any

from ..clients.backend_api import backend_api

logger = logging.getLogger(__name__)


async def execute_tool(name: str, arguments: dict[str, Any]) -> str:
    """Execute a tool call by dispatching to the appropriate backend API method.

    Args:
        name: The function name from OpenAI's tool_call.
        arguments: The parsed JSON arguments.

    Returns:
        JSON string result for OpenAI to consume.
    """
    try:
        if name == "search_products":
            result = await backend_api.search_products(
                q=arguments.get("query", ""),
                category=arguments.get("category", ""),
                tags=arguments.get("tags", ""),
            )
            return _format_result(result)

        elif name == "get_product_detail":
            product_id = arguments.get("product_id", "")
            result = await backend_api.get_product(product_id)
            return _format_result(result)

        elif name == "check_order_status":
            order_code = arguments.get("order_code", "")
            result = await backend_api.get_order_by_code(order_code)
            return _format_result(result)

        elif name == "get_customer_orders":
            phone = arguments.get("phone", "")
            result = await backend_api.get_customer_orders(phone)
            return _format_result(result)

        elif name == "check_stock":
            product_id = arguments.get("product_id", "")
            result = await backend_api.check_stock(product_id)
            return _format_result(result)

        elif name == "get_categories":
            result = await backend_api.get_categories()
            return _format_result(result)

        elif name == "suggest_products":
            prefs = arguments.get("preferences", "")
            result = await backend_api.suggest_products(prefs=prefs)
            return _format_result(result)

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as e:
        logger.error(f"Tool execution error [{name}]: {e}")
        return json.dumps({
            "error": "Không thể kết nối đến hệ thống. Vui lòng thử lại sau.",
            "details": str(e),
        })


def _format_result(result: dict[str, Any]) -> str:
    """Format API result for OpenAI consumption."""
    # Extract data from paginated response envelope
    if "data" in result and "meta" in result:
        return json.dumps(result, ensure_ascii=False)
    return json.dumps(result, ensure_ascii=False)
