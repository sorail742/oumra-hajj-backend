// **À placer dans `src/app/api/auth/login/route.ts`.**
//
// Route dédiée (pas le proxy générique `[...chemin]`) parce que cette
// réponse a une forme particulière à traiter : poser le cookie d'accès à
// partir de `data.accessToken`, et relayer le `Set-Cookie` du backend
// (refresh token) — voir lib/auth/process-auth-response.ts. Même
// raisonnement que smartsms-frontend, qui a des Route Handlers dédiés pour
// `/api/login`, `/api/logout`, `/api/auth/verify-otp` plutôt que de le
// faire porter par son proxy générique.
//
// Parcours propriétaire/gestionnaire/comptable/super admin — email + mot
// de passe (docs/backend/socle-backend.md §5).
import type { NextRequest } from 'next/server';
import { PREFIXE_API_BACKEND, urlBackend } from '@/lib/api/backend';
import { relayerReponseAuth } from '@/lib/auth/process-auth-response';

export async function POST(requete: NextRequest): Promise<Response> {
  const corps: unknown = await requete.json();
  const reponse = await fetch(
    `${urlBackend()}${PREFIXE_API_BACKEND}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      cache: 'no-store',
    },
  );
  return relayerReponseAuth(reponse);
}
