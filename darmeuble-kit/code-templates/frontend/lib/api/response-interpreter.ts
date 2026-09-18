import { ApiError, type ErrorResponse, type SuccessResponse } from './types';

/**
 * Interprète le statut HTTP et le corps déjà parsé d'une réponse en
 * enveloppe de succès, ou lève l'`ApiError` correspondante. Voir
 * docs/frontend/contrat-api.md — déballe `{success,data,meta}`,
 * contrairement au client d'`oumra-hadj-web-kit` qui n'a rien à déballer.
 */
export function interpreterReponse<T>(
  statusCode: number,
  charge: unknown,
  chemin: string,
  statusText?: string,
): SuccessResponse<T> {
  const estOk = statusCode >= 200 && statusCode < 300;
  if (!estOk) {
    const erreur = charge as ErrorResponse | null;
    if (erreur?.error) {
      throw new ApiError(erreur.error);
    }
    throw new ApiError({
      statusCode,
      message: statusText || 'Erreur inattendue.',
      error: 'UnexpectedResponse',
      path: chemin,
      timestamp: new Date().toISOString(),
    });
  }
  return charge as SuccessResponse<T>;
}
