import type { NextRequest } from 'next/server';
import { PREFIXE_API_BACKEND, urlBackend } from '../api/backend';
import { NOM_COOKIE_REFRESH } from './cookie';

/**
 * Renouvellement interne, appelé par le proxy `[...chemin]` sur un `401` —
 * jamais exposé comme route publique (voir docs/backend/adr/0004-*.md,
 * docs/frontend/adr/0002-*.md). Le navigateur n'appelle jamais
 * `/api/auth/refresh` lui-même.
 *
 * **Hypothèse à vérifier contre l'implémentation backend réelle** : ce
 * gabarit suppose que `POST /api/auth/refresh` lit le refresh token dans
 * un cookie entrant (cohérent avec `cookie-parser` ajouté côté backend
 * pour ce flux, voir ADR-0004) — pas dans le corps de la requête. À
 * ajuster si le contrat réel diffère.
 *
 * Un seul appel en vol par processus serveur — voir la file d'attente de
 * requêtes concurrentes documentée dans docs/backend/adr/0004-*.md
 * §Conséquences : le backend ne traite pas deux appels concurrents sur le
 * même refresh token avec indulgence, c'est ce verrou qui les sérialise
 * côté frontend.
 */

export interface RenouvellementReussi {
  accessToken: string;
  /** En-têtes Set-Cookie du backend à relayer tels quels au navigateur. */
  setCookieRefresh: string[];
}

let renouvellementEnCours: Promise<RenouvellementReussi | null> | null = null;

export function renouvelerJeton(
  requete: NextRequest,
): Promise<RenouvellementReussi | null> {
  const refreshToken = requete.cookies.get(NOM_COOKIE_REFRESH)?.value;
  if (!refreshToken) {
    return Promise.resolve(null);
  }

  renouvellementEnCours ??= (async () => {
    try {
      const reponse = await fetch(
        `${urlBackend()}${PREFIXE_API_BACKEND}/auth/refresh`,
        {
          method: 'POST',
          headers: { Cookie: `${NOM_COOKIE_REFRESH}=${refreshToken}` },
          cache: 'no-store',
        },
      );
      if (!reponse.ok) {
        return null;
      }
      const corps = (await reponse.json()) as {
        success?: boolean;
        data?: { accessToken?: string };
      };
      if (!corps.success || !corps.data?.accessToken) {
        return null;
      }
      return {
        accessToken: corps.data.accessToken,
        setCookieRefresh: reponse.headers.getSetCookie(),
      };
    } catch {
      return null;
    } finally {
      renouvellementEnCours = null;
    }
  })();
  return renouvellementEnCours;
}
