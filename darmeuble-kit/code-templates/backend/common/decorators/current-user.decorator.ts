import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../authenticated-user.interface';

/**
 * Lit l'utilisateur déjà résolu par `JwtAuthGuard`/`JwtStrategy`. Ne
 * recharge jamais rien depuis la base — voir
 * docs/backend/multi-tenant.md.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
