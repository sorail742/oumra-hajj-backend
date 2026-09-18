import { NextResponse } from 'next/server';
import type { ErrorResponse } from './types';

/**
 * Accès au backend NestJS depuis le serveur Next — jamais depuis le
 * navigateur. `BACKEND_URL` est une variable serveur, sans préfixe
 * `NEXT_PUBLIC_`.
 */

export function urlBackend(): string {
  const base = process.env['BACKEND_URL'];
  if (!base) {
    throw new Error(
      'BACKEND_URL absente. Définir la variable dans .env.local — voir .env.example.',
    );
  }
  return base.replace(/\/+$/, '');
}

/**
 * Préfixe de l'API backend. Le cahier des charges ne demande pas de
 * versionnage d'URL — à revoir si un ADR l'introduit plus tard (sur le
 * modèle de smartsms-backend, `/api/v1`, ADR-0017 de ce projet frère).
 */
export const PREFIXE_API_BACKEND = '/api';

export function reponseBackendInjoignable(chemin: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        statusCode: 502,
        message: 'Le service est momentanément indisponible.',
        error: 'BackendUnreachable',
        path: chemin,
        timestamp: new Date().toISOString(),
      },
    } satisfies ErrorResponse,
    { status: 502 },
  );
}
