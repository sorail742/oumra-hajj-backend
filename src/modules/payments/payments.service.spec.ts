import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AgenciesService } from '../agencies/agencies.service';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './schemas/payment.schema';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentModel: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let bookingsService: { findByIdOrFail: jest.Mock; markStepDone: jest.Mock };
  let packagesService: { findByIdOrFail: jest.Mock };

  beforeEach(async () => {
    paymentModel = {
      create: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    bookingsService = { findByIdOrFail: jest.fn(), markStepDone: jest.fn() };
    packagesService = { findByIdOrFail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: BookingsService, useValue: bookingsService },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: {} },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('handleWebhook', () => {
    it('rejette un callback pour une référence de transaction inconnue', async () => {
      paymentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.handleWebhook({
          providerReference: 'unknown',
          status: PaymentStatus.SUCCEEDED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("marque l'étape 'paiement' du dossier comme soldée quand le cumul atteint le prix du forfait", async () => {
      const bookingId = new Types.ObjectId();
      const paymentDoc = {
        _id: { toString: () => 'payment-1' },
        booking: bookingId,
        status: PaymentStatus.PENDING,
        amount: 500,
        save: jest.fn().mockResolvedValue(undefined),
      };
      paymentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(paymentDoc),
      });
      paymentModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { status: PaymentStatus.SUCCEEDED, amount: 500 },
          ]),
      });
      bookingsService.findByIdOrFail.mockResolvedValue({
        packageId: 'package-1',
      });
      packagesService.findByIdOrFail.mockResolvedValue({ price: 500 });

      await service.handleWebhook({
        providerReference: 'ref-1',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(paymentDoc.save).toHaveBeenCalled();
      expect(bookingsService.markStepDone).toHaveBeenCalledWith(
        bookingId.toString(),
        DossierStepKey.PAYMENT,
      );
    });

    it("ne marque pas l'étape 'paiement' comme soldée si le cumul est insuffisant", async () => {
      const bookingId = new Types.ObjectId();
      const paymentDoc = {
        _id: { toString: () => 'payment-1' },
        booking: bookingId,
        status: PaymentStatus.PENDING,
        amount: 200,
        save: jest.fn().mockResolvedValue(undefined),
      };
      paymentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(paymentDoc),
      });
      paymentModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { status: PaymentStatus.SUCCEEDED, amount: 200 },
          ]),
      });
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
