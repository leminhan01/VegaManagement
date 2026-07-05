"""HTTP client for calling NestJS Bot API endpoints."""

from typing import Any, Optional
import httpx
from ..config import settings


class BackendApiClient:
    """Async HTTP client for the NestJS /api/bot/* endpoints."""

    def __init__(self) -> None:
        self._base_url = settings.BACKEND_API_URL
        self._headers = {
            "x-api-key": settings.BOT_API_KEY,
            "Content-Type": "application/json",
        }
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._headers,
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ── Products ──

    async def search_products(
        self, q: str = "", category: str = "", tags: str = "", page: int = 1, limit: int = 10
    ) -> dict[str, Any]:
        """GET /bot/products — search products."""
        client = await self._get_client()
        params: dict[str, Any] = {"page": page, "limit": limit}
        if q:
            params["q"] = q
        if category:
            params["category"] = category
        if tags:
            params["tags"] = tags
        res = await client.get("/products", params=params)
        res.raise_for_status()
        return res.json()

    async def get_product(self, product_id: str) -> dict[str, Any]:
        """GET /bot/products/:id — product detail."""
        client = await self._get_client()
        res = await client.get(f"/products/{product_id}")
        res.raise_for_status()
        return res.json()

    async def check_stock(self, product_id: str) -> dict[str, Any]:
        """GET /bot/products/:id/stock — stock info."""
        client = await self._get_client()
        res = await client.get(f"/products/{product_id}/stock")
        res.raise_for_status()
        return res.json()

    async def suggest_products(self, prefs: str = "", page: int = 1, limit: int = 10) -> dict[str, Any]:
        """GET /bot/products/suggest — product suggestions."""
        client = await self._get_client()
        res = await client.get("/products/suggest", params={"prefs": prefs, "page": page, "limit": limit})
        res.raise_for_status()
        return res.json()

    async def get_categories(self) -> dict[str, Any]:
        """GET /bot/categories — list categories."""
        client = await self._get_client()
        res = await client.get("/categories")
        res.raise_for_status()
        return res.json()

    # ── Orders ──

    async def get_order_by_code(self, order_code: str) -> dict[str, Any]:
        """GET /bot/orders/code/:code — lookup order."""
        client = await self._get_client()
        res = await client.get(f"/orders/code/{order_code}")
        res.raise_for_status()
        return res.json()

    async def get_customer_orders(self, phone: str) -> dict[str, Any]:
        """GET /bot/customers/phone/:phone/orders — customer orders."""
        client = await self._get_client()
        res = await client.get(f"/customers/phone/{phone}/orders")
        res.raise_for_status()
        return res.json()

    # ── Cart (đặt hàng qua chatbot) ──

    async def add_to_cart(self, session_id: str, product_id: str, quantity: int) -> dict[str, Any]:
        """POST /bot/cart/items — thêm sản phẩm vào giỏ của phiên chat (cộng dồn SL)."""
        client = await self._get_client()
        res = await client.post("/cart/items", json={
            "sessionId": session_id,
            "productId": product_id,
            "quantity": quantity,
        })
        res.raise_for_status()
        return res.json()

    async def get_cart(self, session_id: str) -> dict[str, Any]:
        """GET /bot/cart?sessionId= — xem giỏ hàng (kèm giá/tồn kho hiện tại)."""
        client = await self._get_client()
        res = await client.get("/cart", params={"sessionId": session_id})
        res.raise_for_status()
        return res.json()

    async def update_cart_item(self, session_id: str, product_id: str, quantity: int) -> dict[str, Any]:
        """PUT /bot/cart/items/:productId — đặt lại số lượng (quantity 0 → xóa)."""
        client = await self._get_client()
        res = await client.put(f"/cart/items/{product_id}", json={
            "sessionId": session_id,
            "quantity": quantity,
        })
        res.raise_for_status()
        return res.json()

    async def remove_from_cart(self, session_id: str, product_id: str) -> dict[str, Any]:
        """DELETE /bot/cart/items/:productId?sessionId= — xóa sản phẩm khỏi giỏ."""
        client = await self._get_client()
        res = await client.delete(f"/cart/items/{product_id}", params={"sessionId": session_id})
        res.raise_for_status()
        return res.json()

    async def create_order(
        self,
        session_id: str,
        customer_name: str,
        customer_phone: str,
        shipping_address: str,
        note: Optional[str] = None,
    ) -> dict[str, Any]:
        """POST /bot/orders — tạo đơn từ giỏ hàng (COD). Find-or-create customer theo SĐT."""
        client = await self._get_client()
        payload: dict[str, Any] = {
            "sessionId": session_id,
            "customerName": customer_name,
            "customerPhone": customer_phone,
            "shippingAddress": shipping_address,
        }
        if note:
            payload["note"] = note
        res = await client.post("/orders", json=payload)
        res.raise_for_status()
        return res.json()

    # ── Chat Sessions ──

    async def upsert_session(self, data: dict[str, Any]) -> dict[str, Any]:
        """POST /bot/chat-sessions — create/update session."""
        client = await self._get_client()
        res = await client.post("/chat-sessions", json=data)
        res.raise_for_status()
        return res.json()

    async def save_message(self, session_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """POST /bot/chat-sessions/:id/messages — save message."""
        client = await self._get_client()
        res = await client.post(f"/chat-sessions/{session_id}/messages", json=data)
        res.raise_for_status()
        return res.json()

    async def get_session_messages(self, session_id: str) -> list[dict[str, Any]]:
        """GET /bot/chat-sessions/:id — get session with messages."""
        client = await self._get_client()
        res = await client.get(f"/chat-sessions/{session_id}")
        res.raise_for_status()
        result = res.json()
        return result.get("data", {}).get("messages", [])

    # ── Store Config ──

    async def get_full_store_info(self) -> dict[str, Any]:
        """GET /bot/store-info — aggregated store info with branches."""
        client = await self._get_client()
        res = await client.get("/store-info")
        res.raise_for_status()
        return res.json()

    async def get_store_config(self) -> dict[str, Any]:
        """GET /bot/store-config — get all store config as key-value."""
        client = await self._get_client()
        res = await client.get("/store-config")
        res.raise_for_status()
        return res.json()

    async def get_store_config_by_key(self, key: str) -> dict[str, Any]:
        """GET /bot/store-config/:key — get single config."""
        client = await self._get_client()
        res = await client.get(f"/store-config/{key}")
        res.raise_for_status()
        return res.json()


# Singleton instance
backend_api = BackendApiClient()
