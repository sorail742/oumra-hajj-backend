import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RefundPolicyShape,
  RefundPolicyTierShape,
} from '../../types/payment.types';
import { AgenciesService } from '../agencies/agencies.service';
import { ReplaceRefundPolicyDto } from './dto/replace-refund-policy.dto';
import {
  eligibilite,
  joursAvantDepart,
  lirePaliers,
  RefundEligibility,
} from './refund-policy';

export interface RefundContext extends RefundEligibility {
  daysBeforeDeparture: number;
  tiers: RefundPolicyTierShape[];
}

// Idée #58 (backlog "Cent Fonctionnalités") — remboursements
// configurables : chaque agence publie son barème (paliers en jours avant
// le départ), visible du pèlerin avant de réserver et figé sur chaque
// réservation au moment où elle est faite.
@Injectable()
export class RefundPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async getForAgency(agencyId: string): Promise<RefundPolicyShape> {
    const paliers = await this.prisma.refundPolicyTier.findMany({
      where: { agencyId },
      orderBy: { minDaysBeforeDeparture: 'desc' },
    });
    return {
      agencyId,
      tiers: paliers.map((p) => ({
        minDaysBeforeDeparture: p.minDaysBeforeDeparture,
        rate: p.rate,
      })),
    };
  }

  async getForOwner(ownerId: string): Promise<RefundPolicyShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    return this.getForAgency(agence.id);
  }

  async replaceForOwner(
    ownerId: string,
    dto: ReplaceRefundPolicyDto,
  ): Promise<RefundPolicyShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const paliers = verifierPaliers(dto.tiers);
    await this.prisma.$transaction([
      this.prisma.refundPolicyTier.deleteMany({
        where: { agencyId: agence.id },
      }),
      this.prisma.refundPolicyTier.createMany({
        data: paliers.map((p) => ({ agencyId: agence.id, ...p })),
      }),
    ]);
    return this.getForAgency(agence.id);
  }

  /** Taux remboursable d'un paiement de cette réservation, à cet instant. */
  async contextFor(
    bookingId: string,
    maintenant = new Date(),
  ): Promise<RefundContext> {
    const reservation = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        refundPolicySnapshot: true,
        package: { select: { startDate: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    const tiers = lirePaliers(reservation.refundPolicySnapshot);
    const daysBeforeDeparture = joursAvantDepart(
      reservation.package.startDate,
      maintenant,
    );
    return {
      ...eligibilite(
        reservation.status as unknown as BookingStatus,
        tiers,
        daysBeforeDeparture,
      ),
      daysBeforeDeparture,
      tiers,
    };
  }
}

/**
 * Paliers cohérents : seuils distincts, et un taux qui ne remonte jamais
 * quand le départ approche (plus on annule tôt, plus on récupère).
 */
export function verifierPaliers(
  paliers: readonly RefundPolicyTierShape[],
): RefundPolicyTierShape[] {
  const tries = [...paliers].sort(
    (a, b) => b.minDaysBeforeDeparture - a.minDaysBeforeDeparture,
  );
  tries.forEach((p, i) => {
    const precedent = tries[i - 1];
    if (!precedent) return;
    if (precedent.minDaysBeforeDeparture === p.minDaysBeforeDeparture) {
      throw new BadRequestException(
        `Deux paliers à ${p.minDaysBeforeDeparture} jours du départ`,
      );
    }
    if (p.rate > precedent.rate) {
      throw new BadRequestException(
        'Le taux remboursé ne peut pas augmenter à l’approche du départ',
      );
    }
  });
  return tries.map(({ minDaysBeforeDeparture, rate }) => ({
    minDaysBeforeDeparture,
    rate,
  }));
}
