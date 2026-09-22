import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    review: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      aggregate: jest.Mock;
    };
  };
  let bookingsService: {
    findByIdOrFail: jest.Mock;
    countByAgencyAndStatus: jest.Mock;
  };
  let agenciesService: {
    findByIdOrFail: jest.Mock;
    findByOwnerOrFail: jest.Mock;
  };

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

  const zeroBookingCounts = (): Record<BookingStatus, number> => ({
    [BookingStatus.PENDING_PAYMENT]: 0,
    [BookingStatus.CONFIRMED]: 0,
    [BookingStatus.CANCELLED]: 0,
    [BookingStatus.COMPLETED]: 0,
  });

  beforeEach(async () => {
    prisma = {
      review: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    bookingsService = {
      findByIdOrFail: jest.fn(),
      countByAgencyAndStatus: jest.fn(),
    };
    agenciesService = {
      findByIdOrFail: jest.fn(),
      findByOwnerOrFail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: AgenciesService, useValue: agenciesService },
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

  describe('getTrustScore', () => {
    it("rejette si l'agence est introuvable", async () => {
      agenciesService.findByIdOrFail.mockRejectedValue(
        new NotFoundException('Agence introuvable'),
      );

      await expect(service.getTrustScore(agencyId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("renvoie un score indéfini quand aucune donnée n'est disponible (nouvelle agence)", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({ id: agencyId });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue(
        zeroBookingCounts(),
      );

      const result = await service.getTrustScore(agencyId);

      expect(result.score).toBeUndefined();
      expect(result.reviewAverage).toBeUndefined();
      expect(result.completionRate).toBeUndefined();
      expect(result.reviewCount).toBe(0);
      expect(result.concludedBookingsCount).toBe(0);
    });

    it("se base uniquement sur les avis si aucune réservation n'est encore conclue", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({ id: agencyId });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4 },
        _count: { rating: 10 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue({
        ...zeroBookingCounts(),
        [BookingStatus.CONFIRMED]: 3,
      });

      const result = await service.getTrustScore(agencyId);

      // 4/5 * 100 = 80, aucune pondération de complétion appliquée seule.
      expect(result.score).toBe(80);
      expect(result.completionRate).toBeUndefined();
    });

    it("se base uniquement sur le taux de complétion si aucun avis n'existe", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({ id: agencyId });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue({
        ...zeroBookingCounts(),
        [BookingStatus.COMPLETED]: 8,
        [BookingStatus.CANCELLED]: 2,
      });

      const result = await service.getTrustScore(agencyId);

      // 8 / (8+2) = 0.8 -> 80.
      expect(result.score).toBe(80);
      expect(result.reviewAverage).toBeUndefined();
      expect(result.completionRate).toBe(0.8);
      expect(result.concludedBookingsCount).toBe(10);
    });

    it('combine avis et taux de complétion (60/40) quand les deux sont disponibles', async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({ id: agencyId });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 5 },
        _count: { rating: 4 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue({
        ...zeroBookingCounts(),
        [BookingStatus.COMPLETED]: 5,
        [BookingStatus.CANCELLED]: 5,
      });

      const result = await service.getTrustScore(agencyId);

      // (5/5*100)*0.6 + (0.5*100)*0.4 = 60 + 20 = 80.
      expect(result.score).toBe(80);
      expect(result.reviewAverage).toBe(5);
      expect(result.completionRate).toBe(0.5);
    });
  });

  describe('getTrustScore — badge (idée #61)', () => {
    it("n'attribue aucun badge à une agence non validée par l'admin", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({
        id: agencyId,
        validationStatus: AgencyValidationStatus.PENDING,
      });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 5 },
        _count: { rating: 10 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue(
        zeroBookingCounts(),
      );

      const result = await service.getTrustScore(agencyId);

      expect(result.badge).toBeNull();
    });

    it("attribue 'verified' à une agence validée mais sans historique suffisant", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({
        id: agencyId,
        validationStatus: AgencyValidationStatus.APPROVED,
      });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue(
        zeroBookingCounts(),
      );

      const result = await service.getTrustScore(agencyId);

      expect(result.badge).toBe('verified');
    });

    it("n'attribue pas 'trusted' avec un bon score mais trop peu d'avis", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({
        id: agencyId,
        validationStatus: AgencyValidationStatus.APPROVED,
      });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 5 },
        _count: { rating: 1 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue(
        zeroBookingCounts(),
      );

      const result = await service.getTrustScore(agencyId);

      expect(result.score).toBe(100);
      expect(result.badge).toBe('verified');
    });

    it("attribue 'trusted' à une agence validée, avec un bon score et assez d'avis", async () => {
      agenciesService.findByIdOrFail.mockResolvedValue({
        id: agencyId,
        validationStatus: AgencyValidationStatus.APPROVED,
      });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 5 },
      });
      bookingsService.countByAgencyAndStatus.mockResolvedValue(
        zeroBookingCounts(),
      );

      const result = await service.getTrustScore(agencyId);

      expect(result.badge).toBe('trusted');
    });
  });

  describe('findByBooking', () => {
    it("renvoie null si aucun avis n'existe pour la réservation", async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.findByBooking(bookingId)).resolves.toBeNull();
    });

    it("renvoie l'avis s'il existe", async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        pilgrimId,
        agencyId,
        bookingId,
        rating: 4,
        comment: null,
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.findByBooking(bookingId);

      expect(result?.rating).toBe(4);
    });
  });

  // Idée #64 (backlog "Cent Fonctionnalités") — rapport de satisfaction.
  describe('getSatisfactionReport', () => {
    it('agrège la distribution des notes et la moyenne quand des avis existent', async () => {
      agenciesService.findByOwnerOrFail.mockResolvedValue({
        id: agencyId,
        legalName: 'Agence Al-Amine',
      });
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          pilgrimId,
          agencyId,
          bookingId: 'booking-1',
          rating: 5,
          comment: 'Excellent',
          createdAt: new Date('2026-02-01'),
        },
        {
          id: 'review-2',
          pilgrimId: 'pilgrim-2',
          agencyId,
          bookingId: 'booking-2',
          rating: 3,
          comment: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const report = await service.getSatisfactionReport('owner-1');

      expect(report.agencyName).toBe('Agence Al-Amine');
      expect(report.reviewCount).toBe(2);
      expect(report.reviewAverage).toBe(4);
      expect(report.ratingDistribution).toEqual([
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 1 },
        { rating: 4, count: 0 },
        { rating: 5, count: 1 },
      ]);
      expect(report.reviews).toEqual([
        { rating: 5, comment: 'Excellent', createdAt: new Date('2026-02-01') },
        { rating: 3, comment: undefined, createdAt: new Date('2026-01-01') },
      ]);
    });

    it("n'invente pas de moyenne quand l'agence n'a aucun avis", async () => {
      agenciesService.findByOwnerOrFail.mockResolvedValue({
        id: agencyId,
        legalName: 'Agence Al-Amine',
      });
      prisma.review.findMany.mockResolvedValue([]);

      const report = await service.getSatisfactionReport('owner-1');

      expect(report.reviewAverage).toBeUndefined();
      expect(report.reviewCount).toBe(0);
      expect(report.ratingDistribution.every((d) => d.count === 0)).toBe(true);
    });
  });

  describe('getSatisfactionReportCsv', () => {
    it('génère un CSV avec un en-tête et une ligne par avis, échappant les guillemets', async () => {
      agenciesService.findByOwnerOrFail.mockResolvedValue({
        id: agencyId,
        legalName: 'Agence Al-Amine',
      });
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          pilgrimId,
          agencyId,
          bookingId: 'booking-1',
          rating: 5,
          comment: 'Très pro, dit "au top"',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ]);

      const csv = await service.getSatisfactionReportCsv('owner-1');
      const lines = csv.split('\n');

      expect(lines[0]).toBe('date,note,commentaire');
      expect(lines[1]).toBe(
        '2026-02-01T00:00:00.000Z,5,"Très pro, dit ""au top"""',
      );
    });
  });
});
