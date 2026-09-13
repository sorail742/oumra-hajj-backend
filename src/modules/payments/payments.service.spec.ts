import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    payment: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
    };
  };
  let bookingsService: { findByIdOrFail: jest.Mock; markStepDone: jest.Mock };
  let packagesService: { findByIdOrFail: jest.Mock };
  let agenciesService: { findByOwnerOrFail: jest.Mock };
  let notificationsService: { send: jest.Mock };
  let paymentProvider: { initiate: jest.Mock; refund: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn(),
      },
    };
    bookingsService = { findByIdOrFail: jest.fn(), markStepDone: jest.fn() };
    packagesService = { findByIdOrFail: jest.fn() };
    agenciesService = { findByOwnerOrFail: jest.fn() };
    notificationsService = { send: jest.fn().mockResolvedValue([]) };
    paymentProvider = { initiate: jest.fn(), refund: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('initiate', () => {
    const bookingId = 'booking-1';

    it("refuse d'initier un paiement sur une réservation qui n'appartient pas au pèlerin", async () => {
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
      });

      await expect(
        service.initiate('pilgrim-2', {
          bookingId,
          amount: 100,
          method: PaymentMethod.MOBILE_MONEY_ORANGE,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(paymentProvider.initiate).not.toHaveBeenCalled();
    });

    it('délègue au PaymentProvider puis persiste la référence obtenue', async () => {
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
      });
      paymentProvider.initiate.mockResolvedValue({
        providerReference: 'dev-abc-123',
      });
      prisma.payment.create.mockResolvedValue({
        id: 'payment-1',
        bookingId,
        amount: 100,
        currency: 'GNF',
        installmentNumber: 1,
        method: PaymentMethod.MOBILE_MONEY_ORANGE,
        status: 'pending',
        providerReference: 'dev-abc-123',
        receiptRef: null,
        confirmedAt: null,
      });

      const result = await service.initiate('pilgrim-1', {
        bookingId,
        amount: 100,
        method: PaymentMethod.MOBILE_MONEY_ORANGE,
      });

      expect(paymentProvider.initiate).toHaveBeenCalledWith({
        bookingId,
        amount: 100,
        currency: 'GNF',
        method: PaymentMethod.MOBILE_MONEY_ORANGE,
      });
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerReference: 'dev-abc-123',
            installmentNumber: 1,
          }),
        }),
      );
      expect(result.providerReference).toBe('dev-abc-123');
    });

    it('incrémente le numéro de tranche selon les paiements déjà existants', async () => {
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
      });
      prisma.payment.count.mockResolvedValue(2);
      paymentProvider.initiate.mockResolvedValue({
        providerReference: 'dev-abc-123',
      });
      prisma.payment.create.mockResolvedValue({
        id: 'payment-3',
        bookingId,
        amount: 100,
        currency: 'GNF',
        installmentNumber: 3,
        method: PaymentMethod.MOBILE_MONEY_MTN,
        status: 'pending',
        providerReference: 'dev-abc-123',
        receiptRef: null,
        confirmedAt: null,
      });

      await service.initiate('pilgrim-1', {
        bookingId,
        amount: 100,
        method: PaymentMethod.MOBILE_MONEY_MTN,
      });

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ installmentNumber: 3 }),
        }),
      );
    });
  });

  describe('handleWebhook', () => {
    it('rejette un callback pour une référence de transaction inconnue', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.handleWebhook({
          providerReference: 'unknown',
          status: PaymentStatus.SUCCEEDED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("marque l'étape 'paiement' du dossier comme soldée quand le cumul atteint le prix du forfait", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        status: 'pending',
        amount: 500,
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        status: 'succeeded',
        amount: 500,
      });
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'payment-1',
          bookingId: 'booking-1',
          status: 'succeeded',
          amount: 500,
        },
      ]);
      bookingsService.findByIdOrFail.mockResolvedValue({
        packageId: 'package-1',
      });
      packagesService.findByIdOrFail.mockResolvedValue({ price: 500 });

      await service.handleWebhook({
        providerReference: 'ref-1',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
        }),
      );
      expect(bookingsService.markStepDone).toHaveBeenCalledWith(
        'booking-1',
        DossierStepKey.PAYMENT,
      );
    });

    it("ne marque pas l'étape 'paiement' comme soldée si le cumul est insuffisant", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        status: 'pending',
        amount: 200,
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        status: 'succeeded',
        amount: 200,
      });
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'payment-1',
          bookingId: 'booking-1',
          status: 'succeeded',
          amount: 200,
        },
      ]);
      bookingsService.findByIdOrFail.mockResolvedValue({
        packageId: 'package-1',
      });
      packagesService.findByIdOrFail.mockResolvedValue({ price: 500 });

      await service.handleWebhook({
        providerReference: 'ref-1',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(bookingsService.markStepDone).not.toHaveBeenCalled();
    });
  });

  describe('requestRefund (idée #58 — barème clair)', () => {
    const paymentId = 'payment-1';
    const bookingId = 'booking-1';
    const pilgrimId = 'pilgrim-1';

    const buildSucceededPayment = (
      overrides: Partial<{ amount: number; currency: string }> = {},
    ) => ({
      id: paymentId,
      bookingId,
      amount: 1000,
      currency: 'GNF',
      installmentNumber: 1,
      method: 'mobile_money_orange',
      status: 'succeeded',
      providerReference: 'dev-abc-123',
      receiptRef: 'RCPT-1',
      confirmedAt: new Date(),
      refundedAmount: null,
      refundedAt: null,
      ...overrides,
    });

    it("refuse de rembourser un paiement qui n'a jamais réussi", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...buildSucceededPayment(),
        status: 'pending',
      });
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId,
        status: BookingStatus.PENDING_PAYMENT,
      });

      await expect(
        service.requestRefund(pilgrimId, Role.PILGRIM, paymentId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(paymentProvider.refund).not.toHaveBeenCalled();
    });

    it('refuse un remboursement une fois le voyage terminé (barème à 0%)', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildSucceededPayment());
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId,
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.requestRefund(pilgrimId, Role.PILGRIM, paymentId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(paymentProvider.refund).not.toHaveBeenCalled();
    });

    it('rembourse intégralement si la réservation est encore PENDING_PAYMENT (100%)', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildSucceededPayment());
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId,
        status: BookingStatus.PENDING_PAYMENT,
      });
      paymentProvider.refund.mockResolvedValue({
        providerRefundReference: 'dev-refund-1',
      });
      prisma.payment.update.mockResolvedValue({
        ...buildSucceededPayment(),
        status: 'refunded',
        refundedAmount: 1000,
        refundedAt: new Date(),
      });

      const result = await service.requestRefund(
        pilgrimId,
        Role.PILGRIM,
        paymentId,
      );

      expect(paymentProvider.refund).toHaveBeenCalledWith('dev-abc-123', 1000);
      expect(result.refundedAmount).toBe(1000);
      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ recipientIds: [pilgrimId] }),
      );
    });

    it('rembourse à 50% si la réservation est déjà CONFIRMED', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildSucceededPayment());
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId,
        status: BookingStatus.CONFIRMED,
      });
      paymentProvider.refund.mockResolvedValue({
        providerRefundReference: 'dev-refund-1',
      });
      prisma.payment.update.mockResolvedValue({
        ...buildSucceededPayment(),
        status: 'refunded',
        refundedAmount: 500,
        refundedAt: new Date(),
      });

      await service.requestRefund(pilgrimId, Role.PILGRIM, paymentId);

      expect(paymentProvider.refund).toHaveBeenCalledWith('dev-abc-123', 500);
    });

    it("refuse à une agence qui n'est pas propriétaire de la réservation", async () => {
      prisma.payment.findUnique.mockResolvedValue(buildSucceededPayment());
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId,
        agencyId: 'agency-1',
        status: BookingStatus.PENDING_PAYMENT,
      });
      agenciesService.findByOwnerOrFail.mockResolvedValue({
        id: 'other-agency',
      });

      await expect(
        service.requestRefund('agency-owner-1', Role.AGENCY, paymentId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(paymentProvider.refund).not.toHaveBeenCalled();
    });
  });
});
