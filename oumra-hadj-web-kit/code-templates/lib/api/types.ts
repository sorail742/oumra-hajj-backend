/**
 * Formes de réponse du backend Oumra-hadj-project.
 *
 * **Différence structurante avec smartsms-frontend** : il n'y a pas
 * d'enveloppe `{ success, data, meta }`. Une réponse réussie **est** le DTO,
 * directement — vérifié dans le code backend, qui n'a pas de
 * `ResponseInterceptor` global (voir `docs/contrat-api.md`). Ne pas
 * réintroduire cette enveloppe par réflexe si vous avez travaillé sur
 * smartsms-frontend juste avant.
 */

/**
 * Corps d'erreur — format par défaut de NestJS
 * (`HttpExceptionFilter` d'Oumra-hadj-project).
 *
 * - `message` est tantôt une chaîne, tantôt un tableau : `class-validator`
 *   renvoie une entrée par contrainte violée sur une erreur de validation.
 * - `error` (ex. "Bad Request") n'est pas toujours présent.
 * - **Aucun champ `code` métier stable n'existe à ce jour** — contrairement
 *   au contrat que documente smartsms-frontend pour son propre backend.
 *   Ne pas écrire de logique qui suppose sa présence ; voir
 *   `docs/contrat-api.md` pour la stratégie de repli.
 */
export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  error?: string;
}

/**
 * Erreur levée par le client API.
 *
 * Pas de `code`/`details` comme chez smartsms : seuls `statusCode`,
 * `message` et, si `message` était un tableau, `fieldErrors` sont
 * disponibles. Voir `docs/design-system.md` § Erreurs de soumission pour la
 * stratégie d'affichage qui en découle.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly path: string;
  /** Présent seulement si `message` était un tableau (erreur de validation). */
  readonly fieldErrors: string[] | undefined;

  constructor(body: ErrorResponse) {
    const message = Array.isArray(body.message)
      ? (body.message[0] ?? "Erreur inattendue.")
      : body.message;
    super(message);
    this.name = "ApiError";
    this.statusCode = body.statusCode;
    this.path = body.path;
    this.fieldErrors = Array.isArray(body.message) ? body.message : undefined;
  }
}

/** Erreur réseau : le serveur n'a pas répondu. À distinguer d'un 5xx. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Le serveur est injoignable. Vérifiez votre connexion.");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/**
 * Forme de page normalisée côté client.
 *
 * **Aucun endpoint ne pagine côté serveur à ce jour** (voir
 * `docs/contrat-api.md`) : `items`/`total`/`page`/`limit`/`totalPages` sont
 * systématiquement calculés côté client à partir du tableau complet renvoyé
 * par le backend — voir `versPage()` dans `client.ts`. Cette forme existe
 * dès maintenant pour que `DataTable` ait une seule interface à consommer,
 * même si aujourd'hui une seule branche (`versPage`) l'alimente ; elle
 * absorbera une vraie pagination serveur le jour où le backend en expose
 * une, sans changer l'interface consommée par les écrans.
 */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
