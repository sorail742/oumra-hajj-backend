/**
 * Résolue une seule fois par requête HTTP (`JwtStrategy.validate`), jamais
 * rechargée depuis la base par un service — voir
 * docs/backend/multi-tenant.md. `@CurrentUser()` l'expose aux controllers.
 *
 * `organizationId` est nullable : un `super_admin` peut n'être rattaché à
 * aucune organisation (cahier des charges §4). Vérifier explicitement
 * avant usage, jamais d'assertion non-null.
 */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  organizationId: string | null;
  role: 'super_admin' | 'owner' | 'manager' | 'accountant' | 'tenant';
}
