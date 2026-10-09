import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackagesService } from '../packages/packages.service';
import { PaymentsService } from './payments.service';
import { RefundPolicyService } from './refund-policy.service';
import { PaymentProvider } from './providers/payment-provider.interface';

// Montants explicitement factices (ticket #38).
describe('PaymentsService.getTreasuryProjection', () => {
  let findMany: jest.Mock;
  let service: PaymentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-06T00:00:00Z'));
    findMany = jest.fn();
    service = new PaymentsService(
      { booking: { findMany } } as unknown as PrismaService,
      {} as BookingsService,
      {} as PackagesService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
      {} as NotificationsService,
      {} as PaymentProvider,
      {} as RefundPolicyService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('totalise attendu, encaissé et reste dû, et place le solde 30 jours avant le départ', async () => {
    findMany.mockResolvedValue([
      {
        package: { price: 1000, startDate: new Date('2027-03-15T00:00:00Z') },
        payments: [{ amount: 400 }],
        savingsPlan: null,
      },
      {
        package: { price: 500, startDate: new Date('2027-01-10T00:00:00Z') },
        payments: [{ amount: 500 }],
        savingsPlan: null,
      },
    ]);

    const result = await service.getTreasuryProjection('proprietaire-1');

    expect(result.totalExpected).toBe(1500);
    expect(result.totalCollected).toBe(900);
    expect(result.outstandingBalance).toBe(600);
    expect(result.projections).toEqual([
      { month: '2027-02', expectedAmount: 600 },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ agencyId: 'agence-1' }),
      }),
    );
  });

  it("étale le solde selon le plan d'épargne mensuel jusqu'au départ", async () => {
    findMany.mockResolvedValue([
      {
        package: { price: 900, startDate: new Date('2027-01-15T00:00:00Z') },
        payments: [],
        savingsPlan: {
          autoDeduct: true,
          deductAmount: 300,
          nextDeductDate: new Date('2026-11-01T00:00:00Z'),
          frequency: 'monthly',
        },
      },
    ]);

    const result = await service.getTreasuryProjection('proprietaire-1');

    expect(result.projections).toEqual([
      { month: '2026-11', expectedAmount: 300 },
      { month: '2026-12', expectedAmount: 300 },
      { month: '2027-01', expectedAmount: 300 },
    ]);
  });
});
