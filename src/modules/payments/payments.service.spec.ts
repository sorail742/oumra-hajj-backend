import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from './payments.service';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: {} },
      ],
    }).compile();

    service = module.get(PaymentsService);
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
