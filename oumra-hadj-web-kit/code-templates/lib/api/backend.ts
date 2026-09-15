import { NextResponse } from "next/server";
import type { ErrorResponse } from "./types";

/**
 * Accès au backend NestJS (Oumra-hadj-project) depuis le serveur Next —
 * jamais depuis le navigateur.
 *
 * `BACKEND_URL` est une variable serveur, sans préfixe `NEXT_PUBLIC_` : elle
 * ne part pas dans le bundle. Seuls le proxy `src/app/api/[...chemin]` et
 * les Route Handlers d'authentification l'utilisent — voir ADR-0002 de ce
 * kit et `docs/architecture.md`.
 */

export function urlBackend(): string {
  const base = process.env["BACKEND_URL"];
  if (!base) {
    throw new Error(
      "BACKEND_URL absente. Définir la variable dans .env.local — voir .env.example.",
    );
  }
  return base.replace(/\/+$/, "");
}

/**
 * Préfixe de version de l'API backend : `setGlobalPrefix('api')` +
 * `enableVersioning({ type: URI, defaultVersion: '1' })` côté NestJS
 * (`src/setup-app.ts` d'Oumra-hadj-project) — toute route répond sous
 * `/api/v1/...`.
 *
 * **Aucune route hors versioning n'a été repérée à ce jour** (contrairement
 * à smartsms-backend, qui exempte `health`/`docs`/`dev/v1`). Si une route
 * s'avère exposée hors `/api/v1` au moment du câblage réel (Swagger monté
 * en amont du routeur, par exemple), ajouter son préfixe ici plutôt que de
 * la faire échouer en silence — vérifier contre `openapi.json` avant de
 * supposer que ce cas ne se présente pas.
 */
export const PREFIXE_API_BACKEND = "/api/v1";

export function prefixePour(_chemin: string): string {
  // Un seul préfixe aujourd'hui. Signature conservée identique à celle
  // qu'utiliserait une liste d'exceptions (voir le commentaire ci-dessus),
  // pour ne pas devoir changer l'appelant (`route.ts`) le jour où une
  // exception apparaît réellement.
  return PREFIXE_API_BACKEND;
}

/**
 * Réponse quand le backend est injoignable.
 *
 * Le format ci-dessous suit celui du `HttpExceptionFilter` réel
 * d'Oumra-hadj-project (`statusCode`, `timestamp`, `path`, `message`) —
 * **pas** l'enveloppe `{success:false,error:{...}}` de smartsms-backend, qui
 * ne s'applique pas ici. Voir `docs/contrat-api.md`.
 */
export function reponseBackendInjoignable(chemin: string): NextResponse {
  return NextResponse.json(
    {
      statusCode: 502,
      timestamp: new Date().toISOString(),
      path: chemin,
      message: "Le service est momentanément indisponible.",
      error: "BackendUnreachable",
    } satisfies ErrorResponse,
    { status: 502 },
  );
}
