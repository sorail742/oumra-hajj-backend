import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { DUREE_ACCES_S, NOM_COOKIE_ACCES, OPTIONS_COOKIE_ACCES } from './cookie';

/**
 * Lecture / écriture du cookie d'**accès** uniquement. Le refresh token
 * n'est jamais manipulé ici — voir cookie.ts et
 * docs/frontend/architecture.md §"Le proxy" pour la raison : il est posé
 * directement par le backend en `Set-Cookie`, ce frontend le relaie sans
 * le lire ni le reconstruire.
 */

export async function lireAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(NOM_COOKIE_ACCES)?.value;
}

export async function poserAccessToken(accessToken: string): Promise<void> {
  (await cookies()).set(NOM_COOKIE_ACCES, accessToken, {
    ...OPTIONS_COOKIE_ACCES,
    maxAge: DUREE_ACCES_S,
  });
}

export async function effacerAccessToken(): Promise<void> {
  (await cookies()).set(NOM_COOKIE_ACCES, '', {
    ...OPTIONS_COOKIE_ACCES,
    maxAge: 0,
  });
}

export function poserAccessTokenSur(
  reponse: NextResponse,
  accessToken: string,
): void {
  reponse.cookies.set(NOM_COOKIE_ACCES, accessToken, {
    ...OPTIONS_COOKIE_ACCES,
    maxAge: DUREE_ACCES_S,
  });
}

export function effacerAccessTokenSur(reponse: NextResponse): void {
  reponse.cookies.set(NOM_COOKIE_ACCES, '', {
    ...OPTIONS_COOKIE_ACCES,
    maxAge: 0,
  });
}
