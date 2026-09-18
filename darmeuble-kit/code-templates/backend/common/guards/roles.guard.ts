import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../authenticated-user.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Vérifie `@Roles(...)`. S'exécute après `JwtAuthGuard` (authentification) —
 * voir docs/backend/socle-backend.md §3 pour l'ordre des guards globaux.
 *
 * Ne remplace pas `CheckSuperAdmin` pour les actions transverses : un
 * simple `@Roles('super_admin')` suffit pour une route réservée au super
 * admin, mais une action qui traverse plusieurs organisations doit passer
 * par un guard dédié, plus explicite en revue de code — voir
 * `check-super-admin.guard.ts`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      AuthenticatedUser['role'][] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    return requiredRoles.includes(user.role);
  }
}
