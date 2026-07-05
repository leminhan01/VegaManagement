"""Tests cho tool giỏ hàng / đặt hàng — verify execute_tool dispatch đúng method
và truyền session_id."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from src.chatbot.tool_executor import execute_tool
from src.clients import backend_api as backend_api_module

SESSION_ID = "sess-123"
PRODUCT_ID = "prod-abc"


@pytest.mark.asyncio
async def test_add_to_cart_passes_session_id():
    with patch.object(
        backend_api_module.backend_api, "add_to_cart", new=AsyncMock(return_value={"ok": True})
    ) as mocked:
        result = await execute_tool(
            "add_to_cart", {"product_id": PRODUCT_ID, "quantity": 2}, SESSION_ID
        )
    mocked.assert_awaited_once_with(SESSION_ID, PRODUCT_ID, 2)
    assert json.loads(result) == {"ok": True}


@pytest.mark.asyncio
async def test_view_cart_requires_session_id():
    result = await execute_tool("view_cart", {}, session_id=None)
    parsed = json.loads(result)
    assert "error" in parsed  # không có session_id → báo lỗi thay vì crash


@pytest.mark.asyncio
async def test_view_cart_passes_session_id():
    with patch.object(
        backend_api_module.backend_api,
        "get_cart",
        new=AsyncMock(return_value={"items": [], "total": 0, "count": 0}),
    ) as mocked:
        await execute_tool("view_cart", {}, SESSION_ID)
    mocked.assert_awaited_once_with(SESSION_ID)


@pytest.mark.asyncio
async def test_update_cart_item_quantity_zero():
    with patch.object(
        backend_api_module.backend_api, "update_cart_item", new=AsyncMock(return_value={"ok": True})
    ) as mocked:
        await execute_tool(
            "update_cart_item", {"product_id": PRODUCT_ID, "quantity": 0}, SESSION_ID
        )
    mocked.assert_awaited_once_with(SESSION_ID, PRODUCT_ID, 0)


@pytest.mark.asyncio
async def test_remove_from_cart_passes_session_id():
    with patch.object(
        backend_api_module.backend_api, "remove_from_cart", new=AsyncMock(return_value={"ok": True})
    ) as mocked:
        await execute_tool("remove_from_cart", {"product_id": PRODUCT_ID}, SESSION_ID)
    mocked.assert_awaited_once_with(SESSION_ID, PRODUCT_ID)


@pytest.mark.asyncio
async def test_create_order_passes_fields_and_session_id():
    captured = {}

    async def fake_create_order(session_id, customer_name, customer_phone, shipping_address, note):
        captured.update(
            session_id=session_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            shipping_address=shipping_address,
            note=note,
        )
        return {"orderCode": "VF-20260701-001", "finalAmount": 81000}

    with patch.object(backend_api_module.backend_api, "create_order", new=fake_create_order):
        result = await execute_tool(
            "create_order",
            {
                "customer_name": "Lan",
                "customer_phone": "0901234567",
                "shipping_address": "123 Le Loi Q1",
                "note": "Goi nguoi nhan",
            },
            SESSION_ID,
        )

    assert captured["session_id"] == SESSION_ID
    assert captured["customer_name"] == "Lan"
    assert captured["customer_phone"] == "0901234567"
    assert captured["note"] == "Goi nguoi nhan"
    parsed = json.loads(result)
    assert parsed["orderCode"] == "VF-20260701-001"


@pytest.mark.asyncio
async def test_create_order_without_note_defaults_none():
    captured = {}

    async def fake_create_order(session_id, customer_name, customer_phone, shipping_address, note):
        captured["note"] = note
        return {"orderCode": "VF-1", "finalAmount": 1}

    with patch.object(backend_api_module.backend_api, "create_order", new=fake_create_order):
        await execute_tool(
            "create_order",
            {
                "customer_name": "A",
                "customer_phone": "01",
                "shipping_address": "x",
            },
            SESSION_ID,
        )
    assert captured["note"] is None


@pytest.mark.asyncio
async def test_existing_tool_still_works_without_session_id():
    """Các tool tra cứu cũ không cần session_id — vẫn chạy khi session_id=None."""
    with patch.object(
        backend_api_module.backend_api, "get_categories", new=AsyncMock(return_value={"data": []})
    ):
        result = await execute_tool("get_categories", {}, session_id=None)
    assert result  # trả JSON string, không lỗi
