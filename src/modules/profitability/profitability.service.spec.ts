import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { ProfitabilityService } from './profitability.service';

// Montants explicitement factices (idée #48).
describe('ProfitabilityService', () => {
  let prisma: { package: Record<string, jest.Mock> };
  let agences: { findByOwnerOrFail: jest.Mock };
  let service: ProfitabilityService;

  beforeEach(() => {
    prisma = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          agencyId: 'agence-1',
          title: '[DÉMO] Oumra fictive',
          price: 1000,
          currency: 'GNF',
          capacity: 40,
          seatsTaken: 12,
        }),
      },
    };
    agences = {
      findByOwnerOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'agence-1', commissionRate: 0.05 }),
    };
    service = new ProfitabilityService(
      prisma as unknown as PrismaService,
      agences as unknown as AgenciesService,
    );
  });

  const couts = {
    costsPerPilgrim: [
      { label: 'Billet', amount: 500 },
      { label: 'Hôtel', amount: 200 },
    ],
    fixedCosts: [{ label: 'Guide', amount: 3000 }],
  };

  it('calcule marge, seuil de rentabilité et prix plancher', async () => {
    const r = await service.simulate('proprietaire-1', {
      price: 1000,
      capacity: 40,
      expectedPilgrims: 30,
      ...couts,
    });

    // Contribution : 1000 × 0,95 − 700 = 250 ; seuil : 3000 / 250 = 12.
    expect(r.unitContribution).toBe(250);
    expect(r.breakEvenPilgrims).toBe(12);
    expect(r.breakEvenReachable).toBe(true);
    expect(r.currency).toBe('GNF');
    expect(r.scenarios[0]).toEqual({
      kind: 'expected',
      pilgrims: 30,
      revenue: 30000,
      platformCommission: 1500,
      variableCosts: 21000,
      fixedCosts: 3000,
      margin: 4500,
      marginRate: 0.15,
      marginPerPilgrim: 150,
    });
    // (700 × 30 + 3000) / (30 × 0,95) ≈ 842,11.
    expect(r.minimumPrice).toBe(842.11);
    expect(r.scenarios.map((s) => [s.kind, s.pilgrims])).toEqual([
      ['expected', 30],
      ['half', 20],
      ['three_quarters', 30],
      ['full', 40],
    ]);
  });

  it('ne lit jamais le taux de commission ailleurs qu’en base', async () => {
    agences.findByOwnerOrFail.mockResolvedValue({
      id: 'agence-1',
      commissionRate: 0.1,
    });
    const r = await service.simulate('proprietaire-1', {
      price: 1000,
      capacity: 10,
      costsPerPilgrim: [],
      fixedCosts: [],
      // Champ inconnu du DTO, ignoré : le taux vient de l'agence.
      ...({ commissionRate: 0 } as object),
    });
    expect(r.commissionRate).toBe(0.1);
    expect(r.scenarios[0]?.platformCommission).toBe(1000);
  });

  it('reprend le forfait et ajoute le scénario des places vendues', async () => {
    const r = await service.simulate('proprietaire-1', {
      packageId: 'forfait-1',
      ...couts,
    });
    expect(r.packageTitle).toBe('[DÉMO] Oumra fictive');
    expect(r.price).toBe(1000);
    expect(r.scenarios.find((s) => s.kind === 'sold')).toMatchObject({
      pilgrims: 12,
      margin: 0,
    });
  });

  it('signale un seuil jamais atteint quand chaque pèlerin coûte plus qu’il ne rapporte', async () => {
    const r = await service.simulate('proprietaire-1', {
      price: 700,
      capacity: 40,
      ...couts,
    });
    expect(r.unitContribution).toBe(-35);
    expect(r.breakEvenPilgrims).toBeUndefined();
    expect(r.breakEvenReachable).toBe(false);
  });

  it("refuse le forfait d'une autre agence", async () => {
    prisma.package.findUnique.mockResolvedValue({
      agencyId: 'agence-2',
      price: 1,
      capacity: 1,
    });
    await expect(
      service.simulate('proprietaire-1', { packageId: 'forfait-9', ...couts }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige prix et capacité sans forfait, et un remplissage possible', async () => {
    await expect(
      service.simulate('proprietaire-1', { price: 1000, ...couts }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.simulate('proprietaire-1', {
        price: 1000,
        capacity: 10,
        expectedPilgrims: 11,
        ...couts,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
