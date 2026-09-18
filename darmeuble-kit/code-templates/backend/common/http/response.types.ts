/**
 * Contrat de réponse HTTP — voir docs/backend/coding-rules-backend.md
 * §"Contrat de réponse HTTP", repris de smartsms-backend.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: PaginationMeta | Record<string, never>;
}

export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  /**
   * Code métier stable — voir docs/frontend/contrat-api.md
   * §"Codes d'erreur métier". À décider dès la Phase 1, contrairement aux
   * deux projets sources qui documentent son absence comme un manque.
   */
  code?: string;
  path: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: ErrorBody;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
