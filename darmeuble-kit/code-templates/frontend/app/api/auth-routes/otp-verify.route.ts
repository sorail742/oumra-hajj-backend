// **À placer dans `src/app/api/auth/otp/verify/route.ts`.**
//
// Parcours locataire — téléphone + OTP SMS (docs/backend/socle-backend.md
// §5). Même traitement que login.route.ts : Route Handler dédié, pas le
// proxy générique, pour poser le cookie d'accès et relayer le refresh.
import type { NextRequest } from 'next/server';
import { PREFIXE_API_BACKEND, urlBackend } from '@/lib/api/backend';
import { relayerReponseAuth } from '@/lib/auth/process-auth-response';

export async function POST(requete: NextRequest): Promise<Response> {
  const corps: unknown = await requete.json();
  const reponse = await fetch(
    `${urlBackend()}${PREFIXE_API_BACKEND}/auth/otp/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      cache: 'no-store',
    },
  );
  return relayerReponseAuth(reponse);
}
