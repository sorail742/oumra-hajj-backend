import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GuideScheduleShape,
  PlanningEntryShape,
} from '../../types/guide-planning.types';
import { AgenciesService } from '../agencies/agencies.service';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';
import { PlanningQueryDto } from './dto/planning-query.dto';
import { conflits } from './planning';

const JOUR_MS = 24 * 60 * 60 * 1000;
const PERIODE_MAX_JOURS = 731;

interface Fenetre {
  debut: Date;
  fin: Date;
}

// Idée #42 (backlog "Cent Fonctionnalités") — planning des guides et
// Mutawif : groupes confiés et indisponibilités de chaque guide de
// l'agence sur une période, chevauchements signalés. L'affectation d'un
// guide déjà pris est refusée à la source (GroupsService.assignGuide) ;
// une indisponibilité déclarée après coup reste possible et apparaît
// comme un conflit à résoudre.
@Injectable()
export class GuidePlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async getAgencySchedule(
    ownerId: string,
    query: PlanningQueryDto,
  ): Promise<GuideScheduleShape[]> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const guides = await this.prisma.user.findMany({
      where: {
        agencyId: agence.id,
        role: Role.GUIDE as unknown as PrismaRole,
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
    return this.plannings(guides, fenetre(query));
  }

  async getMine(
    guideId: string,
    query: PlanningQueryDto,
  ): Promise<GuideScheduleShape> {
    const guide = await this.prisma.user.findUnique({
      where: { id: guideId },
      select: { id: true, fullName: true },
    });
    if (!guide) throw new NotFoundException('Guide introuvable');
    const [planning] = await this.plannings([guide], fenetre(query));
    if (!planning) throw new NotFoundException('Guide introuvable');
    return planning;
  }

  async addUnavailability(
    ownerId: string,
    dto: CreateUnavailabilityDto,
  ): Promise<GuideScheduleShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const guide = await this.prisma.user.findUnique({
      where: { id: dto.guideId },
      select: { id: true, fullName: true, role: true, agencyId: true },
    });
    if (
      !guide ||
      guide.role !== (Role.GUIDE as unknown as PrismaRole) ||
      guide.agencyId !== agence.id
    ) {
      throw new ForbiddenException(
        "Ce guide n'est pas rattaché à votre agence",
      );
    }
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('La fin doit suivre le début');
    }
    await this.prisma.guideUnavailability.create({
      data: {
        agencyId: agence.id,
        guideId: guide.id,
        startDate,
        endDate,
        reason: dto.reason?.trim() || undefined,
      },
    });
    const [planning] = await this.plannings([guide], {
      debut: startDate,
      fin: endDate,
    });
    if (!planning) throw new NotFoundException('Guide introuvable');
    return planning;
  }

  async deleteUnavailability(ownerId: string, id: string): Promise<void> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const { count } = await this.prisma.guideUnavailability.deleteMany({
      where: { id, agencyId: agence.id },
    });
    if (count === 0) throw new NotFoundException('Indisponibilité introuvable');
  }

  private async plannings(
    guides: readonly { id: string; fullName: string }[],
    { debut, fin }: Fenetre,
  ): Promise<GuideScheduleShape[]> {
    const ids = guides.map((g) => g.id);
    if (ids.length === 0) return [];
    const [groupes, absences] = await Promise.all([
      this.prisma.group.findMany({
        where: {
          guideId: { in: ids },
          package: { startDate: { lte: fin }, endDate: { gte: debut } },
        },
        select: {
          id: true,
          title: true,
          guideId: true,
          package: { select: { title: true, startDate: true, endDate: true } },
        },
      }),
      this.prisma.guideUnavailability.findMany({
        where: {
          guideId: { in: ids },
          startDate: { lte: fin },
          endDate: { gte: debut },
        },
      }),
    ]);
    return guides.map((g) => {
      const entries: PlanningEntryShape[] = [
        ...groupes
          .filter((gr) => gr.guideId === g.id)
          .map((gr) => ({
            kind: 'group' as const,
            id: gr.id,
            label: gr.title,
            packageTitle: gr.package.title,
            startDate: gr.package.startDate,
            endDate: gr.package.endDate,
          })),
        ...absences
          .filter((a) => a.guideId === g.id)
          .map((a) => ({
            kind: 'unavailability' as const,
            id: a.id,
            label: a.reason ?? 'Indisponible',
            startDate: a.startDate,
            endDate: a.endDate,
          })),
      ].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      return {
        guideId: g.id,
        guideName: g.fullName,
        entries,
        conflicts: conflits(entries),
      };
    });
  }
}

/** Période demandée ; défaut : d'aujourd'hui à dans un an. */
function fenetre(query: PlanningQueryDto): Fenetre {
  const debut = query.from
    ? new Date(`${query.from}T00:00:00.000Z`)
    : new Date(new Date().toISOString().slice(0, 10));
  const fin = query.to
    ? new Date(`${query.to}T23:59:59.999Z`)
    : new Date(debut.getTime() + 365 * JOUR_MS);
  const jours = (fin.getTime() - debut.getTime()) / JOUR_MS;
  if (Number.isNaN(jours) || jours < 0) {
    throw new BadRequestException('La date de début doit précéder la fin');
  }
  if (jours > PERIODE_MAX_JOURS) {
    throw new BadRequestException('Période limitée à deux ans');
  }
  return { debut, fin };
}
