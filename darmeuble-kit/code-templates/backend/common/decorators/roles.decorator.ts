import { SetMetadata } from '@nestjs/common';
import { AuthenticatedUser } from '../authenticated-user.interface';

export const ROLES_KEY = 'roles';

/**
 * Déclare les rôles autorisés sur une route. Aucun endpoint sensible n'est
 * ouvert par défaut — un controller sans `@Roles(...)` explicite doit être
 * revu en review, pas supposé correct.
 */
export const Roles = (...roles: AuthenticatedUser['role'][]) =>
  SetMetadata(ROLES_KEY, roles);
