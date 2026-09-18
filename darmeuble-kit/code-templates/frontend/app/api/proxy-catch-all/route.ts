import { NextResponse, type NextRequest } from 'next/server';
import { PREFIXE_API_BACKEND, reponseBackendInjoignable, urlBackend } from '@/lib/api/backend';
import { effacerAccessTokenSur, lireAccessToken, poserAccessTokenSur } from '@/lib/auth/session';
import { renouvelerJeton } from '@/lib/auth/refresh';

/**
 * Proxy vers le backend NestJS DarMeuble.
 *
 * **À placer dans `src/app/api/[...chemin]/route.ts`.**
 *
 * Le navigateur appelle `/api/*`, jamais le backend directement. Ajoute
 * l'en-tête `Authorization` lu dans le cookie d'accès, et gère le
 * renouvellement silencieux sur un `401` — voir
 * docs/backend/adr/0004-*.md et docs/frontend/adr/0002-*.md.
 *
 * **Ne gère jamais les routes d'authentification qui émettent un jeton**
 * (`/api/auth/login`, `/api/auth/otp/verify`) — elles ont leurs propres
 * Route Handlers dédiés (`app/api/auth-routes/` dans ce kit), parce que
 * leur réponse a une forme particulière à traiter (voir
 * lib/auth/process-auth-response.ts). Ce fichier ne fait que relayer.
 */

const ENTETES_A_ECARTER = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  // Le cookie ne part jamais vers le backend tel quel — l'access token est
  // relu et renvoyé comme Bearer, le refresh n'a rien à faire ici (voir
  // lib/auth/refresh.ts pour le seul appel qui en a besoin).
  'cookie',
]);

function enTetesRelayees(requete: NextRequest, accessToken?: string): Headers {
  const entetes = new Headers();
  requete.headers.forEach((valeur, cle) => {
    if (!ENTETES_A_ECARTER.has(cle.toLowerCase())) {
      entetes.set(cle, valeur);
    }
  });
  if (accessToken) {
    entetes.set('Authorization', `Bearer ${accessToken}`);
  }
  return entetes;
}

async function appelerBackend(
  requete: NextRequest,
  relatif: string,
  accessToken: string | undefined,
  corpsCapture: ArrayBuffer | null,
): Promise<Response> {
  const cible = `${urlBackend()}${PREFIXE_API_BACKEND}/${relatif}${requete.nextUrl.search}`;
  return fetch(cible, {
    method: requete.method,
    headers: enTetesRelayees(requete, accessToken),
    ...(corpsCapture ? { body: corpsCapture } : {}),
    cache: 'no-store',
  });
}

async function relayer(
  requete: NextRequest,
  contexte: { params: Promise<{ chemin: string[] }> },
): Promise<Response> {
  const { chemin } = await contexte.params;
  const relatif = chemin.join('/');
  const accessToken = await lireAccessToken();

  // Corps capturé en mémoire, pas streamé : le rejeu après renouvellement
  // (ci-dessous) a besoin de le renvoyer une seconde fois — voir la même
  // note dans le proxy d'oumra-hadj-web-kit pour le compromis assumé sur
  // les fichiers volumineux.
  const corpsCapture = requete.body ? await requete.arrayBuffer() : null;

  let reponse: Response;
  try {
    reponse = await appelerBackend(requete, relatif, accessToken, corpsCapture);
  } catch {
    return reponseBackendInjoignable(requete.nextUrl.pathname);
  }

  if (reponse.status === 401 && relatif !== 'auth/refresh') {
    const renouvellement = await renouvelerJeton(requete);

    if (renouvellement) {
      let rejeu: Response;
      try {
        rejeu = await appelerBackend(
          requete,
          relatif,
          renouvellement.accessToken,
          corpsCapture,
        );
      } catch {
        return reponseBackendInjoignable(requete.nextUrl.pathname);
      }
      const relais = await construireReponse(rejeu);
      poserAccessTokenSur(relais, renouvellement.accessToken);
      for (const cookie of renouvellement.setCookieRefresh) {
        relais.headers.append('set-cookie', cookie);
      }
      return relais;
    }

    // Le renouvellement a échoué (refresh expiré, révoqué, ou réutilisé —
    // voir docs/backend/adr/0004-*.md) : la session est terminée.
    const relais = await construireReponse(reponse);
    effacerAccessTokenSur(relais);
    return relais;
  }

  return construireReponse(reponse);
}

async function construireReponse(reponse: Response): Promise<NextResponse> {
  if (reponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const corps = await reponse.arrayBuffer();
  return new NextResponse(corps, {
    status: reponse.status,
    headers: {
      'Content-Type': reponse.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

export const GET = relayer;
export const POST = relayer;
export const PUT = relayer;
export const PATCH = relayer;
export const DELETE = relayer;
