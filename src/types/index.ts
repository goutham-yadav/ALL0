/**
 * Generic API response structure.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standard pagination parameters.
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginated API response structure.
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * User session representations.
 */
export interface UserSession {
  id: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN';
}
