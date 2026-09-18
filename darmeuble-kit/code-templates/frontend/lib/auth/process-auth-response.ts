import { NextResponse } from 'next/server';
import { poserAccessTokenSur } from './session';

/**
 * Traite la réponse backend d'une route qui **émet** un nouveau jeton
 * (`POST /api/auth/login`, `POST /api/auth/otp/verify`) : extrait
 * `data.accessToken`, le pose en cookie httpOnly côté navigateur, relaie
 * tel quel le(s) `Set-Cookie` du backend (le refresh token — voir
 * docs/backend/adr/0004-*.md, docs/frontend/adr/0002-*.md), et ne renvoie
 * jamais `accessToken` en clair dans le corps JSON transmis au navigateur
 * — le cookie suffit, le code applicatif frontend n'a jamais besoin de le
 * lire lui-même.
 *
 * Utilisé par les Route Handlers dédiés aux routes d'authentification
 * (voir `app/api/auth-routes/`), **pas** par le proxy générique
 * `[...chemin]`, qui ne fait que relayer sans inspecter les corps de
 * réponse.
 */
export async function relayerReponseAuth(
  reponseBackend: Response,
): Promise<NextResponse> {
  const corps: unknown = await reponseBackend.json().catch(() => null);

  if (!reponseBackend.ok || !isSuccessEnvelope(corps)) {
    return NextResponse.json(
      corps ?? {
        success: false,
        error: {
          statusCode: reponseBackend.status,
          message: 'Erreur inattendue.',
          error: 'UnexpectedResponse',
          path: '',
          timestamp: new Date().toISOString(),
        },
      },
      { status: reponseBackend.status },
    );
  }

  const { accessToken, ...resteData } = corps.data;
  const relais = NextResponse.json({
    success: true,
    data: resteData,
    meta: corps.meta,
  });
  poserAccessTokenSur(relais, accessToken);

  // `getSetCookie()` (pas `.get('set-cookie')`) : plusieurs en-têtes
  // Set-Cookie ne peuvent pas être fusionnés par une simple virgule (les
  // dates d'expiration de cookie en contiennent) — `.get()` les
  // combinerait de façon invalide. Voir la spec Fetch / undici.
  for (const cookie of reponseBackend.headers.getSetCookie()) {
    relais.headers.append('set-cookie', cookie);
  }

  return relais;
}

interface SuccessEnvelope {
  success: true;
  data: { accessToken: string; [cle: string]: unknown };
  meta: unknown;
}

function isSuccessEnvelope(value: unknown): value is SuccessEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === true &&
    'data' in value &&
    typeof (value as { data: unknown }).data === 'object' &&
    (value as { data: { accessToken?: unknown } }).data !== null &&
    typeof (value as { data: { accessToken?: unknown } }).data.accessToken ===
      'string'
  );
}
