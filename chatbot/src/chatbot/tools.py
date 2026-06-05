"""OpenAI Function Calling tools for the VegiFlow chatbot."""

from openai import pydantic_function_tool
from pydantic import BaseModel, Field
from typing import Optional


# ── Tool Input Schemas ──

class SearchProductsInput(BaseModel):
    """Tìm kiếm sản phẩm thực phẩm chay."""
    query: str = Field(description="Từ khóa tìm kiếm sản phẩm (tên, mô tả)")
    category: Optional[str] = Field(default=None, description="Lọc theo danh mục sản phẩm")
    tags: Optional[str] = Field(default=None, description="Lọc theo tags, phân cách bằng dấu phẩy")


class GetProductDetailInput(BaseModel):
    """Xem chi tiết một sản phẩm."""
    product_id: str = Field(description="ID của sản phẩm cần xem chi tiết")


class CheckOrderStatusInput(BaseModel):
    """Tra cứu trạng thái đơn hàng bằng mã đơn."""
    order_code: str = Field(description="Mã đơn hàng (VD: VF-9001)")


class GetCustomerOrdersInput(BaseModel):
    """Xem lịch sử đơn hàng của khách hàng theo số điện thoại."""
    phone: str = Field(description="Số điện thoại của khách hàng")


class CheckStockInput(BaseModel):
    """Kiểm tra tồn kho của một sản phẩm."""
    product_id: str = Field(description="ID của sản phẩm cần kiểm tra")


class GetCategoriesInput(BaseModel):
    """Lấy danh sách danh mục sản phẩm."""


class SuggestProductsInput(BaseModel):
    """Gợi ý sản phẩm dựa trên sở thích hoặc nhu cầu."""
    preferences: str = Field(description="Sở thích, nhu cầu hoặc tình trạng sức khỏe để gợi ý sản phẩm phù hợp")


# ── Tool Definitions ──

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Tìm kiếm sản phẩm thực phẩm chay trong cửa hàng. Dùng khi khách hỏi về sản phẩm, muốn xem menu, hoặc tìm sản phẩm theo loại.",
            "parameters": SearchProductsInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_detail",
            "description": "Xem chi tiết thông tin một sản phẩm cụ thể: giá, thành phần, dinh dưỡng, nguồn gốc, tồn kho. Dùng khi khách hỏi chi tiết về một sản phẩm.",
            "parameters": GetProductDetailInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_order_status",
            "description": "Tra cứu thông tin và trạng thái đơn hàng bằng mã đơn hàng. Dùng khi khách muốn biết đơn hàng của họ đang ở trạng thái nào.",
            "parameters": CheckOrderStatusInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_orders",
            "description": "Xem lịch sử đơn hàng của khách hàng dựa trên số điện thoại. Dùng khi khách muốn xem các đơn hàng đã đặt.",
            "parameters": GetCustomerOrdersInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_stock",
            "description": "Kiểm tra số lượng tồn kho của một sản phẩm. Dùng khi khách hỏi còn hàng không hoặc muốn biết số lượng available.",
            "parameters": CheckStockInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_categories",
            "description": "Lấy danh sách tất cả danh mục sản phẩm trong cửa hàng. Dùng khi khách muốn xem các loại sản phẩm có sẵn.",
            "parameters": GetCategoriesInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_products",
            "description": "Gợi ý sản phẩm phù hợp dựa trên sở thích, nhu cầu, hoặc tình trạng sức khỏe của khách hàng. Dùng khi khách cần tư vấn chọn sản phẩm.",
            "parameters": SuggestProductsInput.model_json_schema(),
        },
    },
]
