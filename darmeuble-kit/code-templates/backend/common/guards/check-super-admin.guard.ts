import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../authenticated-user.interface';

/**
 * Garde dédiée pour toute action réservée au super admin — voir
 * docs/backend/coding-rules-backend.md (reprise de smartsms-backend) :
 * "toute action réservée au super-admin doit utiliser un guard dédié,
 * jamais un simple check de rôle `admin` dans le controller". Le rôle
 * `super_admin` peut légitimement contourner l'isolation multi-tenant
 * (docs/backend/multi-tenant.md) pour des requêtes transverses — c'est
 * précisément pourquoi ce cas doit être explicite et visible en revue de
 * code, pas un `@Roles('super_admin')` comme un rôle parmi d'autres.
 */
@Injectable()
export class CheckSuperAdmin implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Réservé au super administrateur');
    }
    return true;
  }
}
