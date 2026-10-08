import { Role } from '../common/enums/role.enum';

// Idée #85 (backlog "Cent Fonctionnalités") — piste d'audit exportable.

export class AuditLogShape {
  id!: string;
  actorId?: string;
  actorName?: string;
  actorRole?: Role;
  action!: string;
  entityType!: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt!: Date;
}
