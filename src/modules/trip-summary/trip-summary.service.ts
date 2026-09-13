import { Injectable } from '@nestjs/common';
import { DossierStepStatus } from '../../common/enums/dossier-step-status.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Role } from '../../common/enums/role.enum';
import { TripSummaryShape } from '../../types/trip-summary.types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from '../payments/payments.service';
import { RiteProgressService } from '../rites/rite-progress.service';
import { RiteSheetsService } from '../rites/rite-sheets.service';
import { ReviewsService } from '../reviews/reviews.service';

// Idée #23 (backlog "Cent Fonctionnalités") : agrège des données déjà
// enregistrées par 6 modules différents en un seul objet — c'est pour ça
// que ce vit dans un module dédié plutôt que dans BookingsService, pour ne
// pas faire dépendre le module bookings de payments/rites/reviews (voir les
// imports de TripSummaryModule).
@Injectable()
export class TripSummaryService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly packagesService: PackagesService,
    private readonly agenciesService: AgenciesService,
    private readonly paymentsService: PaymentsService,
    private readonly riteProgressService: RiteProgressService,
    private readonly riteSheetsService: RiteSheetsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  async getForBooking(
    requesterId: string,
    requesterRole: Role,
    bookingId: string,
  ): Promise<TripSummaryShape> {
    const booking = await this.bookingsService.findAuthorizedOrFail(
      requesterId,
      requesterRole,
      bookingId,
    );

    const [pkg, agency, payments, riteProgress, riteSheets, review] =
      await Promise.all([
        this.packagesService.findByIdOrFail(booking.packageId),
        this.agenciesService.findByIdOrFail(booking.agencyId),
        this.paymentsService.findByBooking(booking.id),
        this.riteProgressService.findMine(booking.pilgrimId),
        this.riteSheetsService.listPublished(),
        this.reviewsService.findByBooking(booking.id),
      ]);

    const riteTitleByKey = new Map(riteSheets.map((s) => [s.key, s.title]));
    const succeededPayments = payments.filter(
      (p) => p.status === PaymentStatus.SUCCEEDED,
    );

    return {
      bookingId: booking.id,
      status: booking.status,
      packageTitle: pkg.title,
      pilgrimageType: pkg.type,
      startDate: pkg.startDate,
      endDate: pkg.endDate,
      agencyName: agency.legalName,
      steps: booking.steps.map((step) => ({
        key: step.key,
        status: step.status,
        completedAt:
          step.status === DossierStepStatus.DONE ? step.updatedAt : undefined,
      })),
      totalPaid: succeededPayments.reduce((sum, p) => sum + p.amount, 0),
      currency: succeededPayments[0]?.currency ?? pkg.currency,
      installmentsCount: succeededPayments.length,
      rites: riteProgress.map((progress) => ({
        riteKey: progress.riteKey,
        title: riteTitleByKey.get(progress.riteKey),
        completed: progress.completed,
        tawafCount: progress.tawafCount,
        saiCount: progress.saiCount,
      })),
      review: review
        ? { rating: review.rating, comment: review.comment }
        : undefined,
    };
  }
}
