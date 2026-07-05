"""Map OpenAI tool calls to backend API methods."""

import json
import logging
from typing import Any

from ..clients.backend_api import backend_api
from ..embeddings.service import embedding_service

logger = logging.getLogger(__name__)


async def execute_tool(
    name: str, arguments: dict[str, Any], session_id: str | None = None
) -> str:
    """Execute a tool call by dispatching to the appropriate backend API method.

    Args:
        name: The function name from OpenAI's tool_call.
        arguments: The parsed JSON arguments.
        session_id: ID phiên chat — bắt buộc cho các tool giỏ hàng / đặt hàng
            (add_to_cart, view_cart, update_cart_item, remove_from_cart, create_order).
            Các tool tra cứu khác không cần.

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

        elif name == "semantic_search_products":
            query = arguments.get("query", "")
            top_k = arguments.get("top_k", 5)
            results = await embedding_service.semantic_search(
                query=query,
                top_k=top_k,
            )
            return json.dumps({"data": results, "total": len(results)}, ensure_ascii=False)

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

        elif name == "get_store_info":
            key = arguments.get("key")
            if key:
                result = await backend_api.get_store_config_by_key(key)
            else:
                result = await backend_api.get_full_store_info()
            return _format_result(result)

        elif name == "add_to_cart":
            if not session_id:
                return json.dumps({"error": "Không xác định được phiên chat để thao tác giỏ hàng."})
            product_id = arguments.get("product_id", "")
            quantity = arguments.get("quantity", 1)
            result = await backend_api.add_to_cart(session_id, product_id, quantity)
            return _format_result(result)

        elif name == "view_cart":
            if not session_id:
                return json.dumps({"error": "Không xác định được phiên chat để xem giỏ hàng."})
            result = await backend_api.get_cart(session_id)
            return _format_result(result)

        elif name == "update_cart_item":
            if not session_id:
                return json.dumps({"error": "Không xác định được phiên chat."})
            product_id = arguments.get("product_id", "")
            quantity = arguments.get("quantity", 0)
            result = await backend_api.update_cart_item(session_id, product_id, quantity)
            return _format_result(result)

        elif name == "remove_from_cart":
            if not session_id:
                return json.dumps({"error": "Không xác định được phiên chat."})
            product_id = arguments.get("product_id", "")
            result = await backend_api.remove_from_cart(session_id, product_id)
            return _format_result(result)

        elif name == "create_order":
            if not session_id:
                return json.dumps({"error": "Không xác định được phiên chat để đặt hàng."})
            result = await backend_api.create_order(
                session_id,
                customer_name=arguments.get("customer_name", ""),
                customer_phone=arguments.get("customer_phone", ""),
                shipping_address=arguments.get("shipping_address", ""),
                note=arguments.get("note") or None,
            )
            return _format_result(result)

        else:
            return json.dumps({"error": f"Công cụ không xác định: {name}"})

    except Exception as e:
        logger.error(f"Lỗi thực thi công cụ [{name}]: {e}")
        return json.dumps({
            "error": "Không thể kết nối đến hệ thống. Vui lòng thử lại sau.",
            "details": str(e),
        })


def _format_result(result: dict[str, Any]) -> str:
    """Format API result for OpenAI consumption."""
    if "data" in result and "meta" in result:
        return json.dumps(result, ensure_ascii=False)
    return json.dumps(result, ensure_ascii=False)
