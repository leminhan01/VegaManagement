export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Extract pagination parameters from a query object.
 * Provides sensible defaults: page=1, limit=10, order='desc'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPaginationParams(query: any): PaginationParams {
  const page = Math.max(1, Number(query['page']) || 1);
  const limit = Math.min(100, Math.max(1, Number(query['limit']) || 10));
  const sort = query['sort'] != null ? String(query['sort']) : undefined;
  const orderRaw = String(query['order'] ?? 'desc').toLowerCase();
  const order: 'asc' | 'desc' = orderRaw === 'asc' ? 'asc' : 'desc';

  return { page, limit, sort, order };
}

/**
 * Build a paginated result object from data array, total count, and params.
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}
