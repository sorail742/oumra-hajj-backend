import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PaginatedResult, SuccessResponse } from '../http/response.types';

function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'total' in value &&
    'page' in value &&
    'limit' in value
  );
}

/**
 * Enveloppe globale de succès — voir
 * docs/backend/coding-rules-backend.md §"Contrat de réponse HTTP", repris
 * de smartsms-backend. Une valeur `PaginatedResult` devient
 * `data = items` et `meta = { page, limit, total, totalPages }`, sinon
 * `meta = {}`.
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginatedResult(result)) {
          // `result.items` (un tableau) devient `data` : le type déclaré de
          // l'interceptor (`T`) est celui de la valeur *avant* transformation
          // (un `PaginatedResult<X>`), pas celui qu'on renvoie réellement ici
          // (`X[]`) — TypeScript ne peut pas exprimer cette relation sans
          // machinerie supplémentaire. Cast local et documenté, pas un `any`
          // qui masquerait un vrai problème de typage ailleurs.
          return {
            success: true,
            data: result.items as T,
            meta: {
              page: result.page,
              limit: result.limit,
              total: result.total,
              totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
            },
          };
        }
        return { success: true, data: result, meta: {} };
      }),
    );
  }
}
