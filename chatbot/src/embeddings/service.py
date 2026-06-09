"""Embedding service — generate, store, and search product vectors with pgvector."""

import json
import logging
from typing import Any, Optional

import asyncpg
from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Manages product embeddings using OpenAI + pgvector.

    Connects directly to PostgreSQL to store/query vectors,
    independent of NestJS Prisma layer.
    """

    def __init__(self) -> None:
        self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self._pool: Optional[asyncpg.Pool] = None
        self._model = settings.OPENAI_EMBEDDING_MODEL

    async def _get_pool(self) -> asyncpg.Pool:
        """Get or create the database connection pool."""
        if self._pool is None or self._pool._closed:
            database_url = settings.DATABASE_URL
            self._pool = await asyncpg.create_pool(
                database_url,
                min_size=2,
                max_size=10,
            )
            # Ensure pgvector extension exists
            async with self._pool.acquire() as conn:
                await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            logger.info("✅ Embedding service connected to PostgreSQL with pgvector")
        return self._pool

    async def close(self) -> None:
        """Close the database pool."""
        if self._pool and not self._pool._closed:
            await self._pool.close()
            logger.info("Embedding service connection pool closed")

    # ── Text Building ──────────────────────────────────────────

    def build_embedding_text(self, product: dict[str, Any]) -> str:
        """Build the text content to embed from product data.

        Combines name, description, category, tags for rich semantic meaning.
        """
        parts: list[str] = []

        name = product.get("name", "")
        if name:
            parts.append(f"Tên sản phẩm: {name}")

        short_desc = product.get("shortDesc", "")
        if short_desc:
            parts.append(f"Mô tả ngắn: {short_desc}")

        description = product.get("description", "")
        if description and description != short_desc:
            parts.append(f"Mô tả chi tiết: {description}")

        category_name = product.get("categoryName", "")
        if not category_name and isinstance(product.get("category"), dict):
            category_name = product["category"].get("name", "")
        if category_name:
            parts.append(f"Danh mục: {category_name}")

        tags = product.get("tags", [])
        if tags:
            parts.append(f"Từ khóa: {', '.join(tags)}")

        ingredients = product.get("ingredients", "")
        if ingredients:
            parts.append(f"Thành phần: {ingredients}")

        origin = product.get("origin", "")
        if origin:
            parts.append(f"Nguồn gốc: {origin}")

        return ". ".join(parts)

    # ── Generate Embedding ─────────────────────────────────────

    async def generate_embedding(self, text: str) -> list[float]:
        """Call OpenAI embedding API to generate vector for text."""
        response = await self._openai.embeddings.create(
            model=self._model,
            input=text,
        )
        return response.data[0].embedding

    # ── Save Embedding ─────────────────────────────────────────

    async def save_embedding(
        self,
        product_id: str,
        vector: list[float],
        embedding_text: str,
    ) -> None:
        """Upsert an embedding for a product into the database."""
        pool = await self._get_pool()
        vector_str = "[" + ",".join(str(v) for v in vector) + "]"

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO "ProductEmbedding" (id, "productId", embedding, "embeddingText", "updatedAt")
                VALUES (gen_random_uuid()::text, $1::text, $2::vector, $3::text, NOW())
                ON CONFLICT ("productId")
                DO UPDATE SET embedding = $2::vector, "embeddingText" = $3::text, "updatedAt" = NOW()
                """,
                product_id,
                vector_str,
                embedding_text,
            )
        logger.info(f"💾 Saved embedding for product {product_id}")

    # ── Semantic Search ────────────────────────────────────────

    async def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        min_similarity: float = 0.3,
    ) -> list[dict[str, Any]]:
        """Search products by semantic similarity.

        Flow:
        1. Generate embedding for user query
        2. Compare with product embeddings using cosine distance
        3. Return top-K results above minimum similarity threshold

        Args:
            query: User's search query text.
            top_k: Maximum number of results to return.
            min_similarity: Minimum cosine similarity (0-1) threshold.

        Returns:
            List of product dicts with similarity score.
        """
        pool = await self._get_pool()

        # Step 1: Generate query embedding
        query_vector = await self.generate_embedding(query)
        vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"

        # Step 2: Cosine similarity search via pgvector
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    p.id,
                    p.name,
                    p.slug,
                    p."shortDesc",
                    p.price,
                    p."salePrice",
                    p.images,
                    p.tags,
                    p.origin,
                    p.stock,
                    p.unit,
                    c.name as "categoryName",
                    c.slug as "categorySlug",
                    1 - (pe.embedding <=> $1::vector) as similarity
                FROM "ProductEmbedding" pe
                JOIN "Product" p ON p.id = pe."productId"
                JOIN "Category" c ON c.id = p."categoryId"
                WHERE p."isActive" = true
                  AND 1 - (pe.embedding <=> $1::vector) >= $3
                ORDER BY pe.embedding <=> $1::vector
                LIMIT $2
                """,
                vector_str,
                top_k,
                min_similarity,
            )

        results = []
        for row in rows:
            results.append({
                "id": row["id"],
                "name": row["name"],
                "slug": row["slug"],
                "shortDesc": row["shortDesc"],
                "price": row["price"],
                "salePrice": row["salePrice"],
                "images": row["images"],
                "tags": row["tags"],
                "origin": row["origin"],
                "stock": row["stock"],
                "unit": row["unit"],
                "categoryName": row["categoryName"],
                "categorySlug": row["categorySlug"],
                "similarity": round(float(row["similarity"]), 4),
            })

        logger.info(
            f"🔍 Semantic search '{query[:50]}' → {len(results)} results "
            f"(threshold={min_similarity})"
        )
        return results

    # ── Bulk Sync ──────────────────────────────────────────────

    async def sync_product_embedding(self, product_id: str) -> bool:
        """Generate and save embedding for a single product.

        Fetches product data from NestJS API, generates embedding, saves to DB.
        Used when NestJS creates/updates a product and calls this webhook.
        """
        from ..clients.backend_api import backend_api

        try:
            # Fetch product from NestJS
            result = await backend_api.get_product(product_id)
            product = result.get("data", result)

            embedding_text = self.build_embedding_text(product)
            vector = await self.generate_embedding(embedding_text)
            await self.save_embedding(product_id, vector, embedding_text)
            return True

        except Exception as e:
            logger.error(f"Failed to sync embedding for product {product_id}: {e}")
            return False

    async def sync_all_embeddings(self) -> dict[str, int]:
        """Re-generate embeddings for all active products.

        Returns:
            Dict with synced count and error count.
        """
        from ..clients.backend_api import backend_api

        synced = 0
        errors = 0
        page = 1

        while True:
            result = await backend_api.search_products(page=page, limit=50)
            data = result.get("data", result)

            # Handle paginated response envelope
            products = data.get("data", data) if isinstance(data, dict) else data
            if isinstance(products, dict):
                products = products.get("data", [])

            if not products:
                break

            for product in products:
                try:
                    embedding_text = self.build_embedding_text(product)
                    vector = await self.generate_embedding(embedding_text)
                    await self.save_embedding(product["id"], vector, embedding_text)
                    synced += 1
                except Exception as e:
                    logger.error(f"Error syncing product {product.get('id')}: {e}")
                    errors += 1

            # Check if there are more pages
            meta = data.get("meta", {}) if isinstance(data, dict) else {}
            total_pages = meta.get("totalPages", 1)
            if page >= total_pages:
                break
            page += 1

        logger.info(f"🔄 Bulk sync complete: {synced} synced, {errors} errors")
        return {"synced": synced, "errors": errors}

    # ── Delete Embedding ───────────────────────────────────────

    async def delete_embedding(self, product_id: str) -> None:
        """Delete embedding for a product."""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                'DELETE FROM "ProductEmbedding" WHERE "productId" = $1',
                product_id,
            )
        logger.info(f"🗑️ Deleted embedding for product {product_id}")


# Singleton
embedding_service = EmbeddingService()
