import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Shape tối thiểu của product cần để push sang chatbot tạo embedding.
 * Chỉ gửi `id`, `name`, `description` (theo yêu cầu: embedding chỉ dùng 2 trường này).
 */
type EmbeddableProduct = {
  id: string;
  name: string;
  description?: string | null;
};

/**
 * Bridge đẩy dữ liệu product sang Chatbot (FastAPI) để tạo/xóa embedding.
 *
 * Luồng "push data": NestJS đã có sẵn object product (từ create/update) nên gửi
 * thẳng sang `POST /embeddings/upsert` thay vì để chatbot tự fetch qua bot-api
 * (endpoint đó filter `isPublished=true` → sản phẩm chưa publish sẽ 404).
 *
 * Toàn bộ best-effort: KHÔNG throw — nếu chatbot/OpenAI lỗi, trả false / swallow
 * để không làm fail nghiệp vụ tạo/sửa/xóa sản phẩm.
 */
@Injectable()
export class EmbeddingSyncService {
  private readonly logger = new Logger(EmbeddingSyncService.name);
  private readonly chatbotUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.chatbotUrl = this.configService.get<string>(
      'CHATBOT_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  /** Push product sang `POST /embeddings/upsert`. Trả true nếu chatbot báo OK. */
  async syncProductEmbedding(product: EmbeddableProduct): Promise<boolean> {
    try {
      const response = await fetch(`${this.chatbotUrl}/embeddings/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            id: product.id,
            name: product.name,
            description: product.description ?? '',
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        this.logger.warn(
          `Embedding sync cho sản phẩm ${product.id} thất bại: HTTP ${response.status}`,
        );
        return false;
      }
      const body = (await response.json()) as { success?: boolean };
      return body?.success === true;
    } catch (error) {
      this.logger.warn(
        `Không gọi được embedding service cho sản phẩm ${product.id}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  /** Xóa embedding của product khi soft-delete. Best-effort, không throw. */
  async deleteProductEmbedding(productId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.chatbotUrl}/embeddings/${productId}`,
        {
          method: 'DELETE',
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) {
        this.logger.warn(
          `Xóa embedding sản phẩm ${productId} thất bại: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Không gọi được embedding service để xóa sản phẩm ${productId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
