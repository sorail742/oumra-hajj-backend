import { interpreterReponse } from './response-interpreter';
import { NetworkError, type Page } from './types';

/**
 * Client HTTP unique du projet. Voir docs/frontend/contrat-api.md pour le
 * contrat déballé ici — différent de celui d'`oumra-hadj-web-kit`.
 */

const DELAI_MS = 30_000;

interface OptionsRequete extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export function construireUrl(
  chemin: string,
  params?: OptionsRequete['params'],
): string {
  const url = new URL(chemin, 'http://interne');
  for (const [cle, valeur] of Object.entries(params ?? {})) {
    if (valeur !== undefined) {
      url.searchParams.set(cle, String(valeur));
    }
  }
  return `${url.pathname}${url.search}`;
}

async function executer<T>(
  chemin: string,
  options: OptionsRequete = {},
) {
  const { body, params, headers, ...reste } = options;

  let reponse: Response;
  try {
    reponse = await fetch(construireUrl(chemin, params), {
      ...reste,
      signal: reste.signal ?? AbortSignal.timeout(DELAI_MS),
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (reponse.status === 204) {
    return { success: true as const, data: undefined as T, meta: {} };
  }

  const charge: unknown = await reponse.json().catch(() => null);
  return interpreterReponse<T>(
    reponse.status,
    charge,
    chemin,
    reponse.statusText,
  );
}

async function requete<T>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const enveloppe = await executer<T>(chemin, options);
  return enveloppe.data;
}

export const api = {
  get: <T>(chemin: string, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: 'GET' }),

  post: <T>(chemin: string, body?: unknown, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: 'POST', body }),

  put: <T>(chemin: string, body?: unknown, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: 'PUT', body }),

  patch: <T>(chemin: string, body?: unknown, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: 'PATCH', body }),

  delete: <T>(chemin: string, options?: OptionsRequete) =>
    requete<T>(chemin, { ...options, method: 'DELETE' }),

  /**
   * `GET` pour une collection paginée — `meta` porte la pagination réelle,
   * fournie par le backend dès le départ (`PaginationQueryDto`), pas
   * calculée côté client comme dans `oumra-hadj-web-kit`.
   */
  getPage: async <T>(
    chemin: string,
    params: OptionsRequete['params'],
  ): Promise<Page<T>> => {
    const enveloppe = await executer<T[]>(chemin, { params, method: 'GET' });
    if (!('total' in enveloppe.meta)) {
      throw new Error(
        `Réponse de ${chemin} sans meta de pagination — vérifier que la route utilise bien PaginationQueryDto côté backend.`,
      );
    }
    return {
      items: enveloppe.data,
      total: enveloppe.meta.total,
      page: enveloppe.meta.page,
      limit: enveloppe.meta.limit,
      totalPages: enveloppe.meta.totalPages,
    };
  },
};
