import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, mergeMap } from 'rxjs';
import { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AuditService } from './audit.service';
import { AUDITED_KEY, AuditedOptions, champ } from './audited.decorator';

/**
 * Enregistre dans la piste d'audit chaque route marquée `@Audited`, une
 * fois la réponse obtenue (l'action a réussi). L'auteur vient du jeton,
 * l'entité du paramètre de route ou de la réponse ; aucun corps de
 * requête n'est recopié.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(
    contexte: ExecutionContext,
    suite: CallHandler,
  ): Observable<unknown> {
    const options = this.reflector.get<AuditedOptions | undefined>(
      AUDITED_KEY,
      contexte.getHandler(),
    );
    if (!options) return suite.handle();
    const requete = contexte.switchToHttp().getRequest<AuthenticatedRequest>();
    return suite.handle().pipe(
      mergeMap(async (reponse: unknown) => {
        const brut: unknown = requete.params?.[options.idParam ?? 'id'];
        const parametre = typeof brut === 'string' ? brut : undefined;
        const idReponse = champ(reponse, 'id');
        await this.auditService.record({
          actorId: requete.user?.sub,
          actorRole: requete.user?.role,
          action: options.action,
          entityType: options.entityType,
          entityId:
            parametre ??
            (typeof idReponse === 'string' ? idReponse : undefined),
          metadata: options.metadata?.(reponse),
        });
        return reponse;
      }),
    );
  }
}
