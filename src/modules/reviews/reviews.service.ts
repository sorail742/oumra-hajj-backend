import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingsService } from '../bookings/bookings.service';
import { BookingStatus } from '../bookings/schemas/booking.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

const REVIEWABLE_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly bookingsService: BookingsService,
  ) {}

  async create(
    pilgrimId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDocument> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrim.toString() !== pilgrimId) {
      throw new BadRequestException('Cette réservation ne vous appartient pas');
    }
    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(
        "Cette réservation n'est pas éligible à un avis",
      );
    }

    const existing = await this.reviewModel
      .findOne({ booking: booking._id })
      .exec();
    if (existing) {
      throw new ConflictException('Un avis existe déjà pour cette réservation');
    }

    return this.reviewModel.create({
      pilgrim: pilgrimId,
      agency: booking.agency,
      booking: booking._id,
      rating: dto.rating,
      comment: dto.comment,
    });
  }

  listByAgency(agencyId: string): Promise<ReviewDocument[]> {
    return this.reviewModel
      .find({ agency: new Types.ObjectId(agencyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  findMine(pilgrimId: string): Promise<ReviewDocument[]> {
    return this.reviewModel.find({ pilgrim: pilgrimId }).exec();
  }
}
