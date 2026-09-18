import { z } from 'zod';

/**
 * Rôles et test de droits — cinq rôles à plat, voir
 * docs/backend/socle-backend.md §6. Pas de matrice de permissions fine
 * (contrairement à smartsms-frontend) — le cahier des charges ne la
 * demande pas.
 */

export const roleSchema = z.enum([
  'super_admin',
  'owner',
  'manager',
  'accountant',
  'tenant',
]);

export type Role = z.infer<typeof roleSchema>;

export type ModeCan = 'all' | 'any';

/**
 * L'utilisateur a-t-il l'un des rôles requis ? Sans rôle connu
 * (`undefined`) : `false` — on ne montre jamais une action par défaut.
 *
 * **Ne remplace pas le filtre de portée intra-organisation du
 * `manager`** (docs/backend/multi-tenant.md §"Portée intra-organisation") —
 * `hasRole` répond à « cet utilisateur est-il un gestionnaire ? », pas à
 * « ce gestionnaire est-il assigné à cet immeuble précis ? ». La deuxième
 * question se répond avec la donnée déjà filtrée renvoyée par l'API, pas
 * en reproduisant le filtre côté client.
 */
export function hasRole(
  roleActuel: Role | undefined,
  requis: Role | readonly Role[],
  mode: ModeCan = 'any',
): boolean {
  if (!roleActuel) {
    return false;
  }
  const liste: readonly Role[] = Array.isArray(requis) ? requis : [requis];
  if (liste.length === 0) {
    return true;
  }
  return mode === 'all'
    ? liste.length === 1 && liste[0] === roleActuel
    : liste.includes(roleActuel);
}
