import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from './payments.service';
import { RefundPolicyService } from './refund-policy.service';
import { PaymentProvider } from './providers/payment-provider.interface';

// Identifiants et montants explicitement factices (plan d'épargne, ticket 1).
describe("PaymentsService — plan d'épargne", () => {
  let findUnique: jest.Mock;
  let upsert: jest.Mock;
  let findBooking: jest.Mock;
  let service: PaymentsService;

  const planFactice = {
    id: 'plan-1',
    bookingId: 'resa-1',
    targetAmount: 1000,
    autoDeduct: true,
    deductAmount: 100,
    frequency: 'monthly',
    nextDeductDate: new Date('2026-11-07T00:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    findUnique = jest.fn();
    upsert = jest.fn().mockResolvedValue(planFactice);
    findBooking = jest.fn().mockResolvedValue({
      id: 'resa-1',
      pilgrimId: 'pelerin-1',
      packageId: 'forfait-1',
      status: BookingStatus.CONFIRMED,
    });
    service = new PaymentsService(
      { savingsPlan: { findUnique, upsert } } as unknown as PrismaService,
      { findByIdOrFail: findBooking } as unknown as BookingsService,
      {
        findByIdOrFail: jest.fn().mockResolvedValue({ price: 1000 }),
      } as unknown as PackagesService,
      {} as AgenciesService,
      {} as NotificationsService,
      {} as PaymentProvider,
      {} as RefundPolicyService,
    );
  });

  it("refuse la lecture du plan d'une réservation d'un autre pèlerin", async () => {
    await expect(
      service.findSavingsPlanByBooking('pelerin-2', 'resa-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('renvoie le plan au titulaire, ou null sans plan', async () => {
    findUnique.mockResolvedValueOnce(planFactice).mockResolvedValueOnce(null);

    await expect(
      service.findSavingsPlanByBooking('pelerin-1', 'resa-1'),
    ).resolves.toMatchObject({ id: 'plan-1', targetAmount: 1000 });
    await expect(
      service.findSavingsPlanByBooking('pelerin-1', 'resa-1'),
    ).resolves.toBeNull();
  });

  it('exige montant et fréquence pour activer les cotisations automatiques', async () => {
    await expect(
      service.setupSavingsPlan('pelerin-1', 'resa-1', { autoDeduct: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuse un plan sur une réservation annulée', async () => {
    findBooking.mockResolvedValue({
      id: 'resa-1',
      pilgrimId: 'pelerin-1',
      packageId: 'forfait-1',
      status: BookingStatus.CANCELLED,
    });

    await expect(
      service.setupSavingsPlan('pelerin-1', 'resa-1', { autoDeduct: false }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('crée le plan avec le prix du forfait comme objectif', async () => {
    const plan = await service.setupSavingsPlan('pelerin-1', 'resa-1', {
      autoDeduct: true,
      deductAmount: 100,
      frequency: 'monthly',
    });

    expect(plan.targetAmount).toBe(1000);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          targetAmount: 1000,
          frequency: 'monthly',
        }),
      }),
    );
  });
});
