import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Review as PrismaReview } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { AgencyTrustScoreShape } from '../../types/agency.types';
import { ReviewShape, SatisfactionReportShape } from '../../types/review.types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateReviewDto } from './dto/create-review.dto';

const REVIEWABLE_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

// Score de confiance agence (idée #96, backlog "Cent Fonctionnalités") :
// pondération avis/fiabilité — voir AgencyTrustScoreShape pour le détail de
// ce qui remplace le "taux de litiges" évoqué dans le brainstorm, absent
// des données disponibles aujourd'hui.
const REVIEW_WEIGHT = 0.6;
const COMPLETION_WEIGHT = 0.4;

// Badge de certification qualité (idée #61) : "confiance" exige un minimum
// d'avis pour ne pas être débloqué par un seul avis à 5 étoiles.
const TRUSTED_SCORE_THRESHOLD = 70;
const MIN_REVIEWS_FOR_TRUSTED_BADGE = 3;

function toReviewShape(review: PrismaReview): ReviewShape {
  return {
    id: review.id,
    pilgrimId: review.pilgrimId,
    agencyId: review.agencyId,
    bookingId: review.bookingId,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async create(pilgrimId: string, dto: CreateReviewDto): Promise<ReviewShape> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new BadRequestException('Cette réservation ne vous appartient pas');
    }
    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(
        "Cette réservation n'est pas éligible à un avis",
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId: booking.id },
    });
    if (existing) {
      throw new ConflictException('Un avis existe déjà pour cette réservation');
    }

    const review = await this.prisma.review.create({
      data: {
        pilgrimId,
        agencyId: booking.agencyId,
        bookingId: booking.id,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
    return toReviewShape(review);
  }

  async listByAgency(agencyId: string): Promise<ReviewShape[]> {
    const reviews = await this.prisma.review.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map(toReviewShape);
  }

  async findMine(pilgrimId: string): Promise<ReviewShape[]> {
    const reviews = await this.prisma.review.findMany({
      where: { pilgrimId },
    });
    return reviews.map(toReviewShape);
  }

  // Utilisé par TripSummaryService (idée #23) — un avis par réservation
  // (Review.bookingId @unique), null si aucun avis déposé.
  async findByBooking(bookingId: string): Promise<ReviewShape | null> {
    const review = await this.prisma.review.findUnique({
      where: { bookingId },
    });
    return review ? toReviewShape(review) : null;
  }

  async getTrustScore(agencyId: string): Promise<AgencyTrustScoreShape> {
    const agency = await this.agenciesService.findByIdOrFail(agencyId);

    const [reviewStats, bookingCounts] = await Promise.all([
      this.prisma.review.aggregate({
        where: { agencyId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.bookingsService.countByAgencyAndStatus(agencyId),
    ]);

    const reviewCount = reviewStats._count.rating;
    const reviewAverage = reviewStats._avg.rating ?? undefined;

    const concludedBookingsCount =
      bookingCounts[BookingStatus.COMPLETED] +
      bookingCounts[BookingStatus.CANCELLED];
    const completionRate =
      concludedBookingsCount > 0
        ? bookingCounts[BookingStatus.COMPLETED] / concludedBookingsCount
        : undefined;

    let score: number | undefined;
    if (reviewAverage !== undefined && completionRate !== undefined) {
      score =
        (reviewAverage / 5) * 100 * REVIEW_WEIGHT +
        completionRate * 100 * COMPLETION_WEIGHT;
    } else if (reviewAverage !== undefined) {
      score = (reviewAverage / 5) * 100;
    } else if (completionRate !== undefined) {
      score = completionRate * 100;
    }

    const roundedScore = score !== undefined ? Math.round(score) : undefined;

    // Idée #61 : "vérifiée" reflète juste la validation admin déjà en place
    // (ADR implicite d'AgenciesService.approve) ; "confiance" ajoute une
    // exigence de score ET de volume d'avis, pour ne pas récompenser une
    // agence tout juste approuvée et jamais évaluée.
    let badge: AgencyTrustScoreShape['badge'] = null;
    if (agency.validationStatus === AgencyValidationStatus.APPROVED) {
      badge =
        roundedScore !== undefined &&
        roundedScore >= TRUSTED_SCORE_THRESHOLD &&
        reviewCount >= MIN_REVIEWS_FOR_TRUSTED_BADGE
          ? 'trusted'
          : 'verified';
    }

    return {
      agencyId,
      score: roundedScore,
      reviewAverage,
      reviewCount,
      completionRate,
      concludedBookingsCount,
      badge,
    };
  }

  // Idée #64 (backlog "Cent Fonctionnalités") : rapport pensé pour être
  // partagé à un bailleur/partenaire financier en fin de saison — jamais de
  // moyenne fabriquée si aucun avis n'existe (voir SatisfactionReportShape).
  async getSatisfactionReport(
    ownerId: string,
  ): Promise<SatisfactionReportShape> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const reviews = await this.prisma.review.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: 'desc' },
    });

    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: reviews.filter((r) => r.rating === rating).length,
    }));
    const reviewAverage =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : undefined;

    return {
      agencyId: agency.id,
      agencyName: agency.legalName,
      generatedAt: new Date(),
      reviewCount: reviews.length,
      reviewAverage,
      ratingDistribution,
      reviews: reviews
        .map((r) => toReviewShape(r))
        .map((r) => ({
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
    };
  }

  async getSatisfactionReportCsv(ownerId: string): Promise<string> {
    const report = await this.getSatisfactionReport(ownerId);
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = 'date,note,commentaire';
    const rows = report.reviews.map((r) =>
      [
        r.createdAt.toISOString(),
        String(r.rating),
        escapeCsv(r.comment ?? ''),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
