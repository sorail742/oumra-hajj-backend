import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../../common/enums/dossier-step-status.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PilgrimageType } from '../../common/enums/pilgrimage-type.enum';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from '../payments/payments.service';
import { RiteProgressService } from '../rites/rite-progress.service';
import { RiteSheetsService } from '../rites/rite-sheets.service';
import { ReviewsService } from '../reviews/reviews.service';
import { TripSummaryService } from './trip-summary.service';

describe('TripSummaryService (idée #23)', () => {
  let service: TripSummaryService;
  let bookingsService: { findAuthorizedOrFail: jest.Mock };
  let packagesService: { findByIdOrFail: jest.Mock };
  let agenciesService: { findByIdOrFail: jest.Mock };
  let paymentsService: { findByBooking: jest.Mock };
  let riteProgressService: { findMine: jest.Mock };
  let riteSheetsService: { listPublished: jest.Mock };
  let reviewsService: { findByBooking: jest.Mock };

  const bookingId = 'booking-1';
  const pilgrimId = 'pilgrim-1';
  const packageId = 'package-1';
  const agencyId = 'agency-1';

  const buildBooking = () => ({
    id: bookingId,
    pilgrimId,
    packageId,
    agencyId,
    status: BookingStatus.COMPLETED,
    steps: [
      {
        key: DossierStepKey.PAYMENT,
        status: DossierStepStatus.DONE,
        updatedAt: new Date('2026-01-01'),
      },
      {
        key: DossierStepKey.VISA,
        status: DossierStepStatus.PENDING,
        updatedAt: new Date('2026-01-02'),
      },
    ],
  });

  beforeEach(async () => {
    bookingsService = { findAuthorizedOrFail: jest.fn() };
    packagesService = { findByIdOrFail: jest.fn() };
    agenciesService = { findByIdOrFail: jest.fn() };
    paymentsService = { findByBooking: jest.fn() };
    riteProgressService = { findMine: jest.fn() };
    riteSheetsService = { listPublished: jest.fn() };
    reviewsService = { findByBooking: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripSummaryService,
        { provide: BookingsService, useValue: bookingsService },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: RiteProgressService, useValue: riteProgressService },
        { provide: RiteSheetsService, useValue: riteSheetsService },
        { provide: ReviewsService, useValue: reviewsService },
      ],
    }).compile();

    service = module.get(TripSummaryService);
  });

  it("propage le refus d'accès de BookingsService sans appeler les autres services", async () => {
    bookingsService.findAuthorizedOrFail.mockRejectedValue(
      new ForbiddenException("Vous n'avez pas accès à cette réservation"),
    );

    await expect(
      service.getForBooking(pilgrimId, Role.PILGRIM, bookingId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(packagesService.findByIdOrFail).not.toHaveBeenCalled();
  });

  it('agrège étapes, paiements réussis, rites et avis quand tout est disponible', async () => {
    bookingsService.findAuthorizedOrFail.mockResolvedValue(buildBooking());
    packagesService.findByIdOrFail.mockResolvedValue({
      id: packageId,
      title: 'Oumra Ramadan 2026',
      type: PilgrimageType.OUMRA,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-15'),
      currency: 'GNF',
    });
    agenciesService.findByIdOrFail.mockResolvedValue({
      id: agencyId,
      legalName: 'Agence Al-Amine',
    });
    paymentsService.findByBooking.mockResolvedValue([
      {
        amount: 3000,
        currency: 'GNF',
        status: PaymentStatus.SUCCEEDED,
        method: PaymentMethod.MOBILE_MONEY_ORANGE,
      },
      {
        amount: 2000,
        currency: 'GNF',
        status: PaymentStatus.SUCCEEDED,
        method: PaymentMethod.MOBILE_MONEY_ORANGE,
      },
      {
        amount: 500,
        currency: 'GNF',
        status: PaymentStatus.FAILED,
        method: PaymentMethod.MOBILE_MONEY_ORANGE,
      },
    ]);
    riteProgressService.findMine.mockResolvedValue([
      { riteKey: 'ihram', completed: true, tawafCount: 0, saiCount: 0 },
      { riteKey: 'tawaf', completed: true, tawafCount: 7, saiCount: 0 },
    ]);
    riteSheetsService.listPublished.mockResolvedValue([
      { key: 'ihram', title: "L'Ihram" },
      { key: 'tawaf', title: 'Le Tawaf' },
    ]);
    reviewsService.findByBooking.mockResolvedValue({
      rating: 5,
      comment: 'Très bien organisé',
    });

    const result = await service.getForBooking(
      pilgrimId,
      Role.PILGRIM,
      bookingId,
    );

    expect(result.packageTitle).toBe('Oumra Ramadan 2026');
    expect(result.agencyName).toBe('Agence Al-Amine');
    // Seuls les paiements SUCCEEDED comptent (3000 + 2000, pas les 500 FAILED).
    expect(result.totalPaid).toBe(5000);
    expect(result.installmentsCount).toBe(2);
    expect(result.steps).toEqual([
      {
        key: DossierStepKey.PAYMENT,
        status: DossierStepStatus.DONE,
        completedAt: new Date('2026-01-01'),
      },
      {
        key: DossierStepKey.VISA,
        status: DossierStepStatus.PENDING,
        completedAt: undefined,
      },
    ]);
    expect(result.rites).toEqual([
      {
        riteKey: 'ihram',
        title: "L'Ihram",
        completed: true,
        tawafCount: 0,
        saiCount: 0,
      },
      {
        riteKey: 'tawaf',
        title: 'Le Tawaf',
        completed: true,
        tawafCount: 7,
        saiCount: 0,
      },
    ]);
    expect(result.review).toEqual({
      rating: 5,
      comment: 'Très bien organisé',
    });
  });

  it("n'invente ni avis ni titre de fiche de rite quand ils n'existent pas", async () => {
    bookingsService.findAuthorizedOrFail.mockResolvedValue(buildBooking());
    packagesService.findByIdOrFail.mockResolvedValue({
      id: packageId,
      title: 'Oumra Ramadan 2026',
      type: PilgrimageType.OUMRA,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-15'),
      currency: 'GNF',
    });
    agenciesService.findByIdOrFail.mockResolvedValue({
      id: agencyId,
      legalName: 'Agence Al-Amine',
    });
    paymentsService.findByBooking.mockResolvedValue([]);
    riteProgressService.findMine.mockResolvedValue([
      { riteKey: 'rite-retire', completed: false, tawafCount: 0, saiCount: 0 },
    ]);
    riteSheetsService.listPublished.mockResolvedValue([]);
    reviewsService.findByBooking.mockResolvedValue(null);

    const result = await service.getForBooking(
      pilgrimId,
      Role.PILGRIM,
      bookingId,
    );

    expect(result.review).toBeUndefined();
    expect(result.rites[0].title).toBeUndefined();
    expect(result.totalPaid).toBe(0);
    expect(result.currency).toBe('GNF'); // repli sur la devise du forfait
  });
});
