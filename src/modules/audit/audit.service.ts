import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Role as PrismaRole } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { BOM_UTF8, celluleCsv } from '../../common/utils/csv';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogShape } from '../../types/audit.types';
import { AuditMetadata } from './audited.decorator';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

export interface AuditEntry {
  actorId?: string;
  actorRole?: Role;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: AuditMetadata;
}

const JOUR_MS = 24 * 60 * 60 * 1000;
// Une consultation ou un export porte sur un an au plus.
const PERIODE_MAX_JOURS = 366;
const LIMITE_CONSULTATION = 500;
const LIMITE_EXPORT = 10_000;

// Idée #85 (backlog "Cent Fonctionnalités") — piste d'audit. Écriture
// seule depuis le reste de l'application (aucune route de modification
// ni de suppression) ; lecture et export réservés à l'administration.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une action. Ne fait jamais échouer l'action auditée, déjà
   * effectuée : un échec d'écriture est signalé dans les journaux.
   */
  async record(entree: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entree.actorId,
          actorRole: entree.actorRole as unknown as PrismaRole | undefined,
          action: entree.action,
          entityType: entree.entityType,
          entityId: entree.entityId,
          metadata: entree.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (erreur) {
      this.logger.error(
        `Audit non enregistré : ${entree.action} ${entree.entityType} ${entree.entityId ?? ''}`,
        erreur instanceof Error ? erreur.stack : undefined,
      );
    }
  }

  async list(query: ListAuditQueryDto): Promise<AuditLogShape[]> {
    return this.chercher(query, LIMITE_CONSULTATION);
  }

  async exportCsv(query: ListAuditQueryDto): Promise<string> {
    const lignes = await this.chercher(query, LIMITE_EXPORT);
    const entete = [
      'Date (UTC)',
      'Action',
      'Entité',
      'Identifiant',
      'Auteur',
      'Rôle',
      'Identifiant auteur',
      'Détails',
    ]
      .map(celluleCsv)
      .join(';');
    const corps = lignes.map((l) =>
      [
        l.createdAt.toISOString(),
        l.action,
        l.entityType,
        l.entityId,
        l.actorName,
        l.actorRole,
        l.actorId,
        l.metadata ? JSON.stringify(l.metadata) : '',
      ]
        .map(celluleCsv)
        .join(';'),
    );
    return `${BOM_UTF8}${[entete, ...corps].join('\r\n')}`;
  }

  private async chercher(
    query: ListAuditQueryDto,
    limite: number,
  ): Promise<AuditLogShape[]> {
    const { debut, fin } = periode(query);
    const entrees = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: debut, lt: fin },
        ...(query.action && { action: query.action }),
        ...(query.entityType && { entityType: query.entityType }),
        ...(query.entityId && { entityId: query.entityId }),
        ...(query.actorId && { actorId: query.actorId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
    const auteurs = await this.prisma.user.findMany({
      where: {
        id: {
          in: [
            ...new Set(entrees.flatMap((e) => (e.actorId ? [e.actorId] : []))),
          ],
        },
      },
      select: { id: true, fullName: true },
    });
    const noms = new Map(auteurs.map((a) => [a.id, a.fullName]));
    return entrees.map((e) => ({
      id: e.id,
      actorId: e.actorId ?? undefined,
      actorName: e.actorId ? noms.get(e.actorId) : undefined,
      actorRole: (e.actorRole as unknown as Role | null) ?? undefined,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? undefined,
      metadata: (e.metadata as AuditMetadata | null) ?? undefined,
      createdAt: e.createdAt,
    }));
  }
}

/** Bornes AAAA-MM-JJ incluses ; défaut : les 30 derniers jours. */
function periode(query: ListAuditQueryDto): { debut: Date; fin: Date } {
  const fin = query.to
    ? new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + JOUR_MS)
    : new Date();
  const debut = query.from
    ? new Date(`${query.from}T00:00:00.000Z`)
    : new Date(fin.getTime() - 30 * JOUR_MS);
  const ecart = (fin.getTime() - debut.getTime()) / JOUR_MS;
  if (Number.isNaN(ecart) || ecart <= 0) {
    throw new BadRequestException(
      'La date de début doit précéder la date de fin',
    );
  }
  if (ecart > PERIODE_MAX_JOURS) {
    throw new BadRequestException(
      `Période limitée à ${PERIODE_MAX_JOURS} jours`,
    );
  }
  return { debut, fin };
}
