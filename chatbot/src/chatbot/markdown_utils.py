"""Tiện ích xử lý markdown cho phản hồi chatbot.

Agent phát ra markdown thống nhất (để web render đẹp). Các kênh không hỗ trợ
markdown (Zalo, Messenger) cần strip về plain text tại lớp webhook — đây là
biên vận chuyển, không phải nơi của agent (xem nguyên tắc kiến trúc).
"""

import re


def strip_markdown_for_sms(text: str) -> str:
    """Chuyển markdown của LLM thành plain text cho Zalo/Messenger.

    - Ảnh ![alt](url) -> alt
    - Link [text](url) -> text
    - **bold** / __bold__ -> bold
    - *italic* / _italic_ -> italic
    - `code` -> code
    - bullet '-', '*' -> '•'
    """
    if not text:
        return text

    # Ảnh: ![alt](url) -> giữ alt nếu có ý nghĩa, bỏ URL
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
    # Link: [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # In đậm: **x** hoặc __x__ -> x
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    # In nghiêng: *x* hoặc _x_ (đơn, tránh đụng ** đã xử lý)
    text = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'\1', text)
    text = re.sub(r'(?<!_)_([^_\n]+)_(?!_)', r'\1', text)
    # Code: `x` -> x
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Gạch đầu dòng: '-', '*' đầu dòng -> '• '
    text = re.sub(r'^\s*[-*]\s+', '• ', text, flags=re.MULTILINE)

    return text.strip()
