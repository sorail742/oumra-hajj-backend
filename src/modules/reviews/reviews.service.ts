import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Review as PrismaReview } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { AgencyTrustScoreShape } from '../../types/agency.types';
import { ReviewShape } from '../../types/review.types';
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

  async getTrustScore(agencyId: string): Promise<AgencyTrustScoreShape> {
    await this.agenciesService.findByIdOrFail(agencyId);

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

    return {
      agencyId,
      score: score !== undefined ? Math.round(score) : undefined,
      reviewAverage,
      reviewCount,
      completionRate,
      concludedBookingsCount,
    };
  }
}
