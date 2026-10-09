import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { SeasonsService } from './seasons.service';

// Données et montants explicitement factices (idée #65).
function reservation(
  status: string,
  payments: { amount: number; refundedAmount?: number }[] = [],
  rating?: number,
  disputes = 0,
) {
  return {
    status,
    payments: payments.map((p) => ({
      currency: 'GNF',
      refundedAmount: null,
      ...p,
    })),
    review: rating ? { rating } : null,
    _count: { disputes },
  };
}

function forfait(
  annee: number,
  type: string,
  capacity: number,
  price: number,
  bookings: ReturnType<typeof reservation>[],
) {
  return {
    type,
    startDate: new Date(Date.UTC(annee, 5, 1)),
    capacity,
    price,
    currency: 'GNF',
    bookings,
  };
}

describe('SeasonsService', () => {
  let prisma: { package: Record<string, jest.Mock> };
  let service: SeasonsService;

  beforeEach(() => {
    prisma = { package: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new SeasonsService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });

  it('regroupe par année et type, net des remboursements', async () => {
    prisma.package.findMany.mockResolvedValue([
      forfait(2026, 'oumra', 10, 1000, [
        reservation('confirmed', [{ amount: 1000 }], 5),
        reservation(
          'cancelled',
          [{ amount: 400, refundedAmount: 300 }],
          undefined,
          1,
        ),
      ]),
      forfait(2026, 'oumra', 10, 2000, [
        reservation('completed', [{ amount: 500 }, { amount: 500 }], 4),
      ]),
      forfait(2025, 'hadj', 5, 5000, []),
    ]);

    const r = await service.compare('proprietaire-1', {
      fromYear: 2025,
      toYear: 2026,
    });

    expect(r.seasons.map((s) => [s.year, s.type])).toEqual([
      [2025, 'hadj'],
      [2026, 'oumra'],
    ]);
    expect(r.seasons[1]).toEqual({
      year: 2026,
      type: 'oumra',
      packages: 2,
      capacity: 20,
      bookings: 2,
      cancellations: 1,
      fillRate: 0.1,
      cancellationRate: 0.333,
      averagePrice: [{ currency: 'GNF', amount: 1500 }],
      collected: [{ currency: 'GNF', amount: 2100 }],
      reviews: 2,
      averageRating: 4.5,
      disputes: 1,
    });
    expect(r.seasons[0]).toMatchObject({
      bookings: 0,
      fillRate: 0,
      collected: [],
    });
    expect(r.seasons[0]?.cancellationRate).toBeUndefined();
    expect(r.seasons[0]?.averageRating).toBeUndefined();
  });

  it('ne lit que les forfaits de son agence sur la période', async () => {
    await service.compare('proprietaire-1', { fromYear: 2024, toYear: 2026 });
    expect(prisma.package.findMany.mock.calls[0][0].where).toEqual({
      agencyId: 'agence-1',
      startDate: {
        gte: new Date(Date.UTC(2024, 0, 1)),
        lt: new Date(Date.UTC(2027, 0, 1)),
      },
    });
  });

  it('couvre par défaut les trois dernières saisons', async () => {
    const r = await service.compare('proprietaire-1', {});
    const annee = new Date().getUTCFullYear();
    expect([r.fromYear, r.toYear]).toEqual([annee - 2, annee]);
  });

  it('refuse une période inversée ou trop longue', async () => {
    for (const q of [
      { fromYear: 2026, toYear: 2025 },
      { fromYear: 2010, toYear: 2026 },
    ]) {
      await expect(service.compare('proprietaire-1', q)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });
});
