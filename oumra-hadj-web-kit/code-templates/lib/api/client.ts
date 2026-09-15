import { interpreterReponse } from "./response-interpreter";
import { NetworkError, type Page } from "./types";

/**
 * Client HTTP unique du projet.
 *
 * ## Pourquoi un wrapper et pas Axios
 *
 * ADR-0002 (ce kit) impose que tout appel passe par les Route Handlers de
 * Next. Côté client, TanStack Query gère déjà retry, cache et annulation —
 * Axios ne ferait que transporter, pour un poids de bundle non négligeable.
 * Ce fichier existe de toute façon : c'est ici que vit le typage des
 * erreurs et la normalisation de pagination.
 *
 * ## Ce que ce client ne fait pas
 *
 * Il ne retente pas, ne met pas en cache, ne déduplique pas — TanStack
 * Query s'en charge.
 */

const DELAI_MS = 30_000;

interface OptionsRequete extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Paramètres de requête. Les valeurs `undefined` sont omises. */
  params?: Record<string, string | number | boolean | undefined>;
}

export function construireUrl(
  chemin: string,
  params?: OptionsRequete["params"],
): string {
  // Chemin relatif : le navigateur appelle les Route Handlers de Next,
  // jamais le backend directement — voir ADR-0002.
  const url = new URL(chemin, "http://interne");
  for (const [cle, valeur] of Object.entries(params ?? {})) {
    if (valeur !== undefined) {
      url.searchParams.set(cle, String(valeur));
    }
  }
  return `${url.pathname}${url.search}`;
}

async function requete<T>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const { body, params, headers, ...reste } = options;

  let reponse: Response;
  try {
    reponse = await fetch(construireUrl(chemin, params), {
      ...reste,
      signal: reste.signal ?? AbortSignal.timeout(DELAI_MS),
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    // Le serveur n'a pas répondu — à distinguer d'un 5xx, qui est une réponse.
    throw new NetworkError(cause);
  }

  // 204 No Content : les DELETE du backend n'ont pas de corps
  // (ex. AuthController.logout, `@HttpCode(HttpStatus.NO_CONTENT)`).
  if (reponse.status === 204) {
    return undefined as T;
  }

  const charge: unknown = await reponse.json().catch(() => null);
  return interpreterReponse<T>(
    reponse.status,
    charge,
    chemin,
    reponse.statusText,
  );
}

export const api = {
  get: <T>(chemin: string, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: "GET" }),

  post: <T>(chemin: string, body?: unknown, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: "POST", body }),

  put: <T>(chemin: string, body?: unknown, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: "PUT", body }),

  patch: <T>(chemin: string, body?: unknown, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: "PATCH", body }),

  delete: <T>(chemin: string, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: "DELETE" }),

  /**
   * `GET` pour une liste, normalisée en `Page<T>`.
   *
   * **Contrairement à smartsms-frontend, il n'y a qu'une seule branche ici**
   * — aucun endpoint ne pagine côté serveur à ce jour (voir
   * `docs/contrat-api.md`), donc pas de `meta` à lire dans une enveloppe qui
   * n'existe pas non plus. Le jour où le backend introduit une vraie
   * pagination sur un endpoint, c'est ici et seulement ici que ça change —
   * jamais dans un composant.
   */
  getPage: async <T>(
    chemin: string,
    params: OptionsRequete["params"],
    defauts: { page: number; limit: number },
  ): Promise<Page<T>> => {
    const donnees = await requete<T[]>(chemin, { params, method: "GET" });
    return versPage(donnees, defauts);
  },
};

/** Toujours passer par cette fonction, jamais lire un tableau brut dans un composant. */
export function versPage<T>(
  liste: T[],
  defauts: { page: number; limit: number },
): Page<T> {
  return {
    items: liste,
    total: liste.length,
    page: defauts.page,
    limit: defauts.limit,
    totalPages: Math.max(1, Math.ceil(liste.length / defauts.limit)),
  };
}
