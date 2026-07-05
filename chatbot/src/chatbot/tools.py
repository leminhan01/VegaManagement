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


class SemanticSearchInput(BaseModel):
    """Tìm kiếm sản phẩm thông minh bằng AI semantic search."""
    query: str = Field(description="Câu hỏi hoặc mô tả nhu cầu của khách hàng")
    top_k: int = Field(default=5, description="Số lượng kết quả trả về")


class GetStoreInfoInput(BaseModel):
    """Lấy thông tin cửa hàng."""
    key: Optional[str] = Field(
        default=None,
        description="Key cụ thể (address, phone, open_hours, return_policy, shipping_policy, warranty_policy...) hoặc bỏ trống để lấy tất cả thông tin gồm chi nhánh và mạng xã hội",
    )


class AddToCartInput(BaseModel):
    """Thêm sản phẩm vào giỏ hàng của khách (cộng dồn số lượng nếu đã có)."""
    product_id: str = Field(description="ID của sản phẩm cần thêm vào giỏ")
    quantity: int = Field(default=1, ge=1, description="Số lượng cần thêm (phải >= 1)")


class ViewCartInput(BaseModel):
    """Xem giỏ hàng hiện tại của khách (danh sách sản phẩm + tổng tạm tính)."""


class UpdateCartItemInput(BaseModel):
    """Cập nhật số lượng của một sản phẩm trong giỏ. Truyền quantity=0 để xóa sản phẩm."""
    product_id: str = Field(description="ID của sản phẩm cần thay đổi số lượng")
    quantity: int = Field(ge=0, description="Số lượng mới. Truyền 0 để xóa sản phẩm khỏi giỏ")


class RemoveFromCartInput(BaseModel):
    """Xóa một sản phẩm khỏi giỏ hàng."""
    product_id: str = Field(description="ID của sản phẩm cần xóa khỏi giỏ")


class CreateOrderInput(BaseModel):
    """Tạo đơn hàng từ giỏ hàng của khách (thanh toán COD). Chỉ dùng khi khách đã xác nhận đặt."""
    customer_name: str = Field(description="Họ tên đầy đủ của khách nhận hàng")
    customer_phone: str = Field(description="Số điện thoại của khách (dùng để find-or-create khách và tra cứu đơn sau này)")
    shipping_address: str = Field(description="Địa chỉ giao hàng đầy đủ")
    note: str = Field(default="", description="Ghi chú cho đơn hàng (tuỳ chọn, có thể bỏ trống)")


# ── Tool Definitions ──

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Tìm kiếm sản phẩm thực phẩm chay theo từ khóa. Dùng khi khách tìm sản phẩm theo tên cụ thể hoặc mã sản phẩm.",
            "parameters": SearchProductsInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "semantic_search_products",
            "description": (
                "Tìm kiếm sản phẩm thông minh bằng AI hiểu ngữ nghĩa. "
                "Ưu tiên dùng tool này khi khách hỏi về sản phẩm theo nhu cầu/sở thích. "
                "Ví dụ: 'món nào nhiều protein', 'đồ ăn vặt chay', 'sản phẩm organic', "
                "'gợi ý món cho người mới ăn chay', 'thực phẩm giảm cân'. "
                "Trả về top 5 sản phẩm phù hợp nhất dựa trên AI semantic search."
            ),
            "parameters": SemanticSearchInput.model_json_schema(),
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
    {
        "type": "function",
        "function": {
            "name": "get_store_info",
            "description": (
                "Lấy thông tin cửa hàng: địa chỉ, số điện thoại, giờ mở cửa, email, fanpage, "
                "chính sách giao hàng/đổi trả/bảo hành, chi nhánh, mạng xã hội (Zalo, Facebook, TikTok). "
                "Dùng khi khách hỏi thông tin liên hệ, địa chỉ, chi nhánh gần nhất, hoặc về cửa hàng."
            ),
            "parameters": GetStoreInfoInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_cart",
            "description": (
                "Thêm một sản phẩm vào giỏ hàng của khách với số lượng tương ứng. "
                "Dùng khi khách muốn mua/đặt/lấy một sản phẩm (VD: 'mua 2 đậu phụ', 'cho vào giỏ 1 nấm'). "
                "Sau khi thêm, LUÔN gọi view_cart để hiển thị lại giỏ cho khách xác nhận."
            ),
            "parameters": AddToCartInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "view_cart",
            "description": (
                "Xem giỏ hàng hiện tại của khách: danh sách sản phẩm, số lượng, giá và tổng tạm tính. "
                "Dùng khi khách hỏi 'giỏ hàng', 'tôi đã chọn gì', hoặc sau khi thêm/sửa sản phẩm để xác nhận."
            ),
            "parameters": ViewCartInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_cart_item",
            "description": (
                "Thay đổi số lượng của một sản phẩm trong giỏ. Truyền quantity=0 để xóa sản phẩm đó. "
                "Dùng khi khách muốn đổi số lượng (VD: 'đổi thành 3 cái') hoặc bớt món."
            ),
            "parameters": UpdateCartItemInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_from_cart",
            "description": "Xóa hẳn một sản phẩm khỏi giỏ hàng. Dùng khi khách không muốn mua món đó nữa.",
            "parameters": RemoveFromCartInput.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": (
                "Tạo đơn hàng từ giỏ hàng của khách (thanh toán khi nhận hàng COD). "
                "CHỈ gọi tool này sau khi: (1) khách đã XÁC NHẬN đặt toàn bộ giỏ, "
                "và (2) đã thu thập ĐỦ họ tên + số điện thoại + địa chỉ giao. "
                "Nếu thiếu thông tin, hãy hỏi khách trước khi gọi. Trả về mã đơn và tổng tiền."
            ),
            "parameters": CreateOrderInput.model_json_schema(),
        },
    },
]
