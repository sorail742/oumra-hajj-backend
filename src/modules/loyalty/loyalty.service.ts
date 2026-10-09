import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus as PrismaBookingStatus, Prisma } from '@prisma/client';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LoyaltyMemberShape,
  LoyaltyProgramShape,
  LoyaltyTierShape,
  MyLoyaltyShape,
} from '../../types/loyalty.types';
import { AgenciesService } from '../agencies/agencies.service';
import { ReplaceLoyaltyTiersDto } from './dto/replace-loyalty-tiers.dto';

const COMPLETED = BookingStatus.COMPLETED as unknown as PrismaBookingStatus;
const CONFIRMED = BookingStatus.CONFIRMED as unknown as PrismaBookingStatus;

/**
 * Voyage effectué : réservation terminée, ou confirmée dont le forfait est
 * revenu — l'agence ne passe pas toujours ses réservations à `completed`.
 */
function voyagesEffectues(maintenant: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: COMPLETED },
      { status: CONFIRMED, package: { endDate: { lt: maintenant } } },
    ],
  };
}

/** Palier atteint pour ce nombre de voyages (paliers triés croissants). */
export function palierAtteint(
  paliers: LoyaltyTierShape[],
  voyages: number,
): LoyaltyTierShape | undefined {
  const atteints = paliers.filter((p) => p.minTrips <= voyages);
  return atteints[atteints.length - 1];
}

function versPalier(p: {
  minTrips: number;
  label: string;
  benefit: string;
}): LoyaltyTierShape {
  return { minTrips: p.minTrips, label: p.label, benefit: p.benefit };
}

// Idée #47 (backlog "Cent Fonctionnalités") — programme de fidélité : les
// voyages effectués avec une agence ouvrent ses paliers. L'agence voit ses
// pèlerins fidèles (nom et nombre de voyages, rien de plus) ; le pèlerin voit
// son palier et ce qui le sépare du suivant, agence par agence.
@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async getProgram(agencyId: string): Promise<LoyaltyProgramShape> {
    const agence = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        legalName: true,
        loyaltyTiers: { orderBy: { minTrips: 'asc' } },
      },
    });
    if (!agence) throw new NotFoundException('Agence introuvable');
    return {
      agencyId: agence.id,
      agencyName: agence.legalName,
      tiers: agence.loyaltyTiers.map(versPalier),
    };
  }

  async getOwnProgram(ownerId: string): Promise<LoyaltyProgramShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    return this.getProgram(agence.id);
  }

  async replaceOwnTiers(
    ownerId: string,
    dto: ReplaceLoyaltyTiersDto,
  ): Promise<LoyaltyProgramShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const seuils = dto.tiers.map((t) => t.minTrips);
    if (new Set(seuils).size !== seuils.length) {
      throw new BadRequestException(
        'Deux paliers ne peuvent pas demander le même nombre de voyages',
      );
    }
    await this.prisma.$transaction([
      this.prisma.loyaltyTier.deleteMany({ where: { agencyId: agence.id } }),
      this.prisma.loyaltyTier.createMany({
        data: dto.tiers.map((t) => ({
          agencyId: agence.id,
          minTrips: t.minTrips,
          label: t.label.trim(),
          benefit: t.benefit.trim(),
        })),
      }),
    ]);
    return this.getProgram(agence.id);
  }

  /** Pèlerins ayant voyagé avec l'agence, du plus fidèle au moins fidèle. */
  async listMembers(ownerId: string): Promise<LoyaltyMemberShape[]> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const [{ tiers }, reservations] = await Promise.all([
      this.getProgram(agence.id),
      this.prisma.booking.findMany({
        where: { agencyId: agence.id, ...voyagesEffectues(new Date()) },
        select: {
          pilgrimId: true,
          pilgrim: { select: { fullName: true } },
          package: { select: { endDate: true } },
        },
      }),
    ]);
    const parPelerin = new Map<string, LoyaltyMemberShape>();
    for (const r of reservations) {
      const membre = parPelerin.get(r.pilgrimId) ?? {
        pilgrimId: r.pilgrimId,
        pilgrimName: r.pilgrim.fullName,
        trips: 0,
        lastTripEnd: r.package.endDate,
      };
      membre.trips += 1;
      if (r.package.endDate > membre.lastTripEnd) {
        membre.lastTripEnd = r.package.endDate;
      }
      parPelerin.set(r.pilgrimId, membre);
    }
    return [...parPelerin.values()]
      .map((m) => ({ ...m, tier: palierAtteint(tiers, m.trips) }))
      .sort(
        (a, b) =>
          b.trips - a.trips ||
          b.lastTripEnd.getTime() - a.lastTripEnd.getTime(),
      );
  }

  /** Fidélité du pèlerin auprès de chaque agence avec laquelle il a voyagé. */
  async getMine(pilgrimId: string): Promise<MyLoyaltyShape[]> {
    const reservations = await this.prisma.booking.findMany({
      where: { pilgrimId, ...voyagesEffectues(new Date()) },
      select: {
        agencyId: true,
        agency: {
          select: {
            legalName: true,
            loyaltyTiers: { orderBy: { minTrips: 'asc' } },
          },
        },
      },
    });
    const parAgence = new Map<
      string,
      MyLoyaltyShape & { tous: LoyaltyTierShape[] }
    >();
    for (const r of reservations) {
      const ligne = parAgence.get(r.agencyId) ?? {
        agencyId: r.agencyId,
        agencyName: r.agency.legalName,
        trips: 0,
        tous: r.agency.loyaltyTiers.map(versPalier),
      };
      ligne.trips += 1;
      parAgence.set(r.agencyId, ligne);
    }
    return [...parAgence.values()]
      .map(({ tous, ...ligne }) => {
        const suivant = tous.find((p) => p.minTrips > ligne.trips);
        return {
          ...ligne,
          tier: palierAtteint(tous, ligne.trips),
          nextTier: suivant && {
            ...suivant,
            tripsToGo: suivant.minTrips - ligne.trips,
          },
        };
      })
      .sort((a, b) => b.trips - a.trips);
  }
}
