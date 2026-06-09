"""Embedding router — internal endpoints for embedding management.

These endpoints are called by NestJS backend when products are created/updated,
and by the chatbot agent for semantic search.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .service import embedding_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/embeddings", tags=["Embeddings"])


# ── Request / Response Models ──────────────────────────────────

class SyncProductRequest(BaseModel):
    """Request body to sync embedding for a single product."""
    product_id: str = Field(description="ID của sản phẩm cần tạo/cập nhật embedding")


class SemanticSearchRequest(BaseModel):
    """Request body for semantic search."""
    query: str = Field(description="Câu hỏi hoặc mô tả cần tìm kiếm")
    top_k: int = Field(default=5, ge=1, le=20, description="Số kết quả trả về")
    min_similarity: float = Field(default=0.3, ge=0.0, le=1.0, description="Ngưỡng tương đồng tối thiểu")


class SyncResponse(BaseModel):
    success: bool
    message: str


class BulkSyncResponse(BaseModel):
    synced: int
    errors: int
    message: str


# ── Endpoints ──────────────────────────────────────────────────

@router.post("/sync", response_model=SyncResponse)
async def sync_single_product(request: SyncProductRequest):
    """Generate/update embedding for a single product.

    Called by NestJS after creating or updating a product.
    """
    success = await embedding_service.sync_product_embedding(request.product_id)
    if success:
        return SyncResponse(success=True, message=f"Đã đồng bộ embedding cho sản phẩm {request.product_id}")
    raise HTTPException(status_code=500, detail=f"Lỗi đồng bộ embedding cho sản phẩm {request.product_id}")


@router.post("/sync-all", response_model=BulkSyncResponse)
async def sync_all_products():
    """Re-generate embeddings for all active products.

    Useful for initial setup or after bulk product imports.
    """
    result = await embedding_service.sync_all_embeddings()
    return BulkSyncResponse(
        synced=result["synced"],
        errors=result["errors"],
        message=f"Đã đồng bộ {result['synced']} sản phẩm, {result['errors']} lỗi",
    )


@router.post("/search")
async def semantic_search(request: SemanticSearchRequest):
    """Semantic search for products using vector similarity.

    Flow:
    1. Generate embedding for the query using OpenAI
    2. Compare with stored product embeddings via pgvector cosine distance
    3. Return top-K most similar products
    """
    results = await embedding_service.semantic_search(
        query=request.query,
        top_k=request.top_k,
        min_similarity=request.min_similarity,
    )
    return {"data": results, "total": len(results)}


@router.delete("/{product_id}")
async def delete_product_embedding(product_id: str):
    """Delete embedding for a product (called when product is deleted)."""
    await embedding_service.delete_embedding(product_id)
    return {"success": True, "message": f"Đã xóa embedding cho sản phẩm {product_id}"}
