import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
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
  let paymentProvider: { initiate: jest.Mock };

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
    paymentProvider = { initiate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: {} },
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
});
