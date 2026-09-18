/**
 * Formes de réponse du backend DarMeuble.
 *
 * **Différence structurante avec `oumra-hadj-web-kit`** : le backend
 * applique une enveloppe unifiée (`ResponseInterceptor`/
 * `AllExceptionsFilter`, voir docs/backend/coding-rules-backend.md) — une
 * réponse réussie n'est **pas** le DTO directement, contrairement au
 * backend Oumra-hadj. Voir docs/frontend/contrat-api.md.
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

/**
 * - `message` est tantôt une chaîne, tantôt un tableau (validation
 *   `class-validator`).
 * - `code` est un identifiant métier stable — voir
 *   docs/frontend/contrat-api.md §"Codes d'erreur métier". Toujours se
 *   brancher dessus, jamais sur le texte de `message`.
 */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: string;
  path: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;
  /** Présent seulement si `message` était un tableau (erreur de validation). */
  readonly fieldErrors: string[] | undefined;

  constructor(body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? (body.message[0] ?? 'Erreur inattendue.')
      : body.message;
    super(message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.fieldErrors = Array.isArray(body.message) ? body.message : undefined;
  }
}

/** Erreur réseau : le serveur n'a pas répondu. À distinguer d'un 5xx. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Le serveur est injoignable. Vérifiez votre connexion.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** Forme de page normalisée côté client, dérivée de `meta`. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
