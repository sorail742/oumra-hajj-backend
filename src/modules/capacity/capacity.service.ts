import { Injectable } from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CapacityPeriodShape,
  CapacitySimulationShape,
  CapacityTripShape,
  DEFAULT_PILGRIMS_PER_GUIDE,
} from '../../types/capacity.types';
import { AgenciesService } from '../agencies/agencies.service';
import { CapacitySimulationQueryDto } from './dto/capacity-simulation-query.dto';

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Découpe le calendrier en périodes où le même ensemble de voyages est en
 * cours (du premier jour à minuit du dernier jour de chacun), et somme la
 * charge de chaque période.
 */
export function periodesDeCharge(
  voyages: CapacityTripShape[],
  pilgrimsPerGuide: number,
): CapacityPeriodShape[] {
  const bornes = (v: CapacityTripShape) => ({
    debut: v.startDate.getTime(),
    fin: v.endDate.getTime() + JOUR_MS,
  });
  const instants = [
    ...new Set(voyages.flatMap((v) => Object.values(bornes(v)))),
  ].sort((a, b) => a - b);
  const periodes: CapacityPeriodShape[] = [];
  for (let i = 0; i < instants.length - 1; i++) {
    const from = instants[i]!;
    const to = instants[i + 1]!;
    const enCours = voyages.filter((v) => {
      const b = bornes(v);
      return b.debut <= from && b.fin >= to;
    });
    if (enCours.length === 0) continue;
    periodes.push({
      from: new Date(from),
      to: new Date(to),
      packageIds: enCours.map((v) => v.packageId),
      plannedPilgrims: enCours.reduce((s, v) => s + v.capacity, 0),
      soldPilgrims: enCours.reduce((s, v) => s + v.seatsTaken, 0),
      guidesNeeded: enCours.reduce((s, v) => s + v.guidesNeeded, 0),
      guidesNeededForSold: enCours.reduce(
        (s, v) => s + Math.ceil(v.seatsTaken / pilgrimsPerGuide),
        0,
      ),
    });
  }
  return periodes;
}

// Idée #68 (backlog "Cent Fonctionnalités") — simulateur de capacité :
// combien de pèlerins l'agence peut réellement encadrer avec ses guides,
// voyage par voyage et aux périodes où plusieurs voyages se chevauchent.
// Calcul à la volée, rien n'est enregistré ; le ratio pèlerins/guide est un
// repère de l'agence, jamais présenté comme une norme réglementaire.
@Injectable()
export class CapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async simulate(
    ownerId: string,
    query: CapacitySimulationQueryDto,
  ): Promise<CapacitySimulationShape> {
    const agencyId = (await this.agenciesService.findByOwnerOrFail(ownerId)).id;
    const pilgrimsPerGuide =
      query.pilgrimsPerGuide ?? DEFAULT_PILGRIMS_PER_GUIDE;
    const extraGuides = query.extraGuides ?? 0;
    const debutDuJour = new Date();
    debutDuJour.setUTCHours(0, 0, 0, 0);

    const [guides, forfaits] = await Promise.all([
      this.prisma.user.count({
        where: {
          agencyId,
          role: Role.GUIDE as unknown as PrismaRole,
          isActive: true,
        },
      }),
      this.prisma.package.findMany({
        where: { agencyId, endDate: { gte: debutDuJour } },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          capacity: true,
          seatsTaken: true,
          groups: { select: { guideId: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    const trips: CapacityTripShape[] = forfaits.map((f) => ({
      packageId: f.id,
      title: f.title,
      startDate: f.startDate,
      endDate: f.endDate,
      capacity: f.capacity,
      seatsTaken: f.seatsTaken,
      guidesNeeded: Math.ceil(f.capacity / pilgrimsPerGuide),
      guidesAssigned: new Set(
        f.groups.flatMap((g) => (g.guideId ? [g.guideId] : [])),
      ).size,
    }));
    const periods = periodesDeCharge(trips, pilgrimsPerGuide);
    const peak = periods.reduce<CapacityPeriodShape | undefined>(
      (max, p) => (!max || p.guidesNeeded > max.guidesNeeded ? p : max),
      undefined,
    );
    const staff = guides + extraGuides;
    const spareGuidesAtPeak = staff - (peak?.guidesNeeded ?? 0);
    return {
      pilgrimsPerGuide,
      guides,
      extraGuides,
      staff,
      trips,
      periods,
      peak,
      spareGuidesAtPeak,
      extraPilgrimsAtPeak: Math.max(0, spareGuidesAtPeak) * pilgrimsPerGuide,
    };
  }
}
