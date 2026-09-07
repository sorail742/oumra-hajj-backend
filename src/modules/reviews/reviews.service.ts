import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Review as PrismaReview } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ReviewShape } from '../../types/review.types';
import { BookingsService } from '../bookings/bookings.service';
import { CreateReviewDto } from './dto/create-review.dto';

const REVIEWABLE_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

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
}
