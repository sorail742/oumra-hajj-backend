import { ApiError, type ErrorResponse } from "./types";

/**
 * Interprète le statut HTTP et le corps déjà parsé d'une réponse : renvoie
 * le corps tel quel sur un statut 2xx (**pas** d'enveloppe à déballer, voir
 * `types.ts`), ou lève l'`ApiError` correspondante.
 *
 * Isolé du client (`client.ts`) pour être partagé avec un futur mécanisme
 * d'upload basé sur `XMLHttpRequest` si le dépôt de documents pèlerin en a
 * besoin pour son suivi de progression (`fetch` ne le permet pas
 * nativement) — les deux chemins doivent produire exactement la même
 * erreur pour le même statut.
 */
export function interpreterReponse<T>(
  statusCode: number,
  charge: unknown,
  chemin: string,
  statusText?: string,
): T {
  const estOk = statusCode >= 200 && statusCode < 300;
  if (estOk) {
    return charge as T;
  }

  const erreur = charge as ErrorResponse | null;
  if (erreur?.statusCode !== undefined && erreur.message !== undefined) {
    throw new ApiError(erreur);
  }

  // Le corps n'était pas au format attendu — proxy injoignable ou erreur
  // d'infrastructure. On construit une erreur cohérente plutôt que de
  // laisser passer un `undefined`.
  throw new ApiError({
    statusCode,
    message: statusText || "Erreur inattendue.",
    error: "UnexpectedResponse",
    path: chemin,
    timestamp: new Date().toISOString(),
  });
}
