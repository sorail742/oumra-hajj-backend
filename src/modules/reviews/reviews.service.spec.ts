import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { BookingsService } from '../bookings/bookings.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    review: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  };
  let bookingsService: { findByIdOrFail: jest.Mock };

  const pilgrimId = 'pilgrim-1';
  const agencyId = 'agency-1';
  const bookingId = 'booking-1';

  const buildBooking = (
    overrides: Partial<{ pilgrimId: string; status: BookingStatus }> = {},
  ) => ({
    id: bookingId,
    pilgrimId,
    agencyId,
    status: BookingStatus.CONFIRMED,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      review: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    bookingsService = { findByIdOrFail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  describe('create', () => {
    it('crée un avis pour une réservation confirmée du pèlerin', async () => {
      bookingsService.findByIdOrFail.mockResolvedValue(buildBooking());
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({
        id: 'review-1',
        pilgrimId,
        agencyId,
        bookingId,
        rating: 5,
        comment: 'Très bon accompagnement',
        createdAt: new Date('2026-01-01'),
      });

      const review = await service.create(pilgrimId, {
        bookingId,
        rating: 5,
        comment: 'Très bon accompagnement',
      });

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          pilgrimId,
          agencyId,
          bookingId,
          rating: 5,
          comment: 'Très bon accompagnement',
        },
      });
      expect(review.id).toBe('review-1');
    });

    it("rejette si la réservation n'appartient pas au pèlerin", async () => {
      bookingsService.findByIdOrFail.mockResolvedValue(
        buildBooking({ pilgrimId: 'un-autre-pelerin' }),
      );

      await expect(
        service.create(pilgrimId, { bookingId, rating: 4 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it("rejette si la réservation n'est pas dans un statut éligible", async () => {
      bookingsService.findByIdOrFail.mockResolvedValue(
        buildBooking({ status: BookingStatus.PENDING_PAYMENT }),
      );

      await expect(
        service.create(pilgrimId, { bookingId, rating: 4 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('rejette si un avis existe déjà pour cette réservation', async () => {
      bookingsService.findByIdOrFail.mockResolvedValue(buildBooking());
      prisma.review.findUnique.mockResolvedValue({ id: 'review-existant' });

      await expect(
        service.create(pilgrimId, { bookingId, rating: 3 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });
  });

  describe('listByAgency', () => {
    it('filtre par agence et trie par date décroissante', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          pilgrimId,
          agencyId,
          bookingId,
          rating: 5,
          comment: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const reviews = await service.listByAgency(agencyId);

      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { agencyId },
        orderBy: { createdAt: 'desc' },
      });
      expect(reviews).toHaveLength(1);
    });
  });

  describe('findMine', () => {
    it('filtre par pèlerin', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          pilgrimId,
          agencyId,
          bookingId,
          rating: 5,
          comment: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const reviews = await service.findMine(pilgrimId);

      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { pilgrimId },
      });
      expect(reviews).toHaveLength(1);
    });
  });
});
