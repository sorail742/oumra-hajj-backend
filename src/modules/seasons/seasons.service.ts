import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BookingStatus as PrismaBookingStatus,
  PaymentStatus as PrismaPaymentStatus,
} from '@prisma/client';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SeasonAmountShape,
  SeasonComparisonShape,
  SeasonShape,
} from '../../types/season.types';
import { AgenciesService } from '../agencies/agencies.service';
import { SeasonComparisonQueryDto } from './dto/season-comparison-query.dto';

const CANCELLED = BookingStatus.CANCELLED as unknown as PrismaBookingStatus;
const ENCAISSES = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.REFUNDED,
] as unknown as PrismaPaymentStatus[];
export const MAX_YEARS = 10;

const arrondi = (n: number, decimales = 2) =>
  Math.round(n * 10 ** decimales) / 10 ** decimales;

/** Somme par devise, triée par devise. */
function parDevise(
  montants: { currency: string; amount: number }[],
): SeasonAmountShape[] {
  const totaux = new Map<string, number>();
  for (const m of montants) {
    totaux.set(m.currency, (totaux.get(m.currency) ?? 0) + m.amount);
  }
  return [...totaux.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, amount: arrondi(amount) }));
}

// Idée #65 (backlog "Cent Fonctionnalités") — comparatif inter-saisons :
// pour chaque année de départ et type de pèlerinage, l'offre (forfaits,
// places, prix moyen), la demande (réservations, remplissage, annulations),
// l'encaissé net et la satisfaction (avis, litiges). Lecture seule,
// calculée à la demande à partir des données conservées.
@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async compare(
    ownerId: string,
    query: SeasonComparisonQueryDto,
  ): Promise<SeasonComparisonShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const toYear = query.toYear ?? new Date().getUTCFullYear();
    const fromYear = query.fromYear ?? toYear - 2;
    if (fromYear > toYear) {
      throw new BadRequestException("L'année de début suit l'année de fin");
    }
    if (toYear - fromYear + 1 > MAX_YEARS) {
      throw new BadRequestException(
        `Comparaison sur ${MAX_YEARS} saisons au plus`,
      );
    }

    const forfaits = await this.prisma.package.findMany({
      where: {
        agencyId: agence.id,
        startDate: {
          gte: new Date(Date.UTC(fromYear, 0, 1)),
          lt: new Date(Date.UTC(toYear + 1, 0, 1)),
        },
      },
      select: {
        type: true,
        startDate: true,
        capacity: true,
        price: true,
        currency: true,
        bookings: {
          select: {
            status: true,
            payments: {
              where: { status: { in: ENCAISSES } },
              select: { amount: true, currency: true, refundedAmount: true },
            },
            review: { select: { rating: true } },
            _count: { select: { disputes: true } },
          },
        },
      },
    });

    const saisons = new Map<string, typeof forfaits>();
    for (const f of forfaits) {
      const cle = `${f.startDate.getUTCFullYear()}|${f.type}`;
      saisons.set(cle, [...(saisons.get(cle) ?? []), f]);
    }

    const seasons: SeasonShape[] = [...saisons.entries()].map(
      ([cle, groupe]) => {
        const [annee, type] = cle.split('|') as [string, string];
        const reservations = groupe.flatMap((f) => f.bookings);
        const annulees = reservations.filter(
          (r) => r.status === CANCELLED,
        ).length;
        const actives = reservations.length - annulees;
        const capacite = groupe.reduce((s, f) => s + f.capacity, 0);
        const notes = reservations.flatMap((r) =>
          r.review ? [r.review.rating] : [],
        );
        const prixMoyens = parDevise(
          groupe.map((f) => ({ currency: f.currency, amount: f.price })),
        ).map((p) => ({
          currency: p.currency,
          amount: arrondi(
            p.amount / groupe.filter((f) => f.currency === p.currency).length,
          ),
        }));
        return {
          year: Number(annee),
          type,
          packages: groupe.length,
          capacity: capacite,
          bookings: actives,
          cancellations: annulees,
          fillRate: capacite > 0 ? arrondi(actives / capacite, 3) : undefined,
          cancellationRate:
            reservations.length > 0
              ? arrondi(annulees / reservations.length, 3)
              : undefined,
          averagePrice: prixMoyens,
          collected: parDevise(
            reservations.flatMap((r) =>
              r.payments.map((p) => ({
                currency: p.currency,
                amount: p.amount - (p.refundedAmount ?? 0),
              })),
            ),
          ),
          reviews: notes.length,
          averageRating:
            notes.length > 0
              ? arrondi(notes.reduce((s, n) => s + n, 0) / notes.length, 1)
              : undefined,
          disputes: reservations.reduce((s, r) => s + r._count.disputes, 0),
        };
      },
    );
    seasons.sort((a, b) => a.year - b.year || a.type.localeCompare(b.type));
    return { fromYear, toYear, seasons };
  }
}
