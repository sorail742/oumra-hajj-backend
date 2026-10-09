import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { LoyaltyService, palierAtteint } from './loyalty.service';

// Données explicitement factices (idée #47).
const d = (iso: string) => new Date(iso);
const PALIERS = [
  { minTrips: 1, label: '[DÉMO] Bienvenue', benefit: 'Kit de voyage' },
  { minTrips: 3, label: '[DÉMO] Fidèle', benefit: 'Transfert offert' },
];

function reservation(pilgrimId: string, fin: string) {
  return {
    pilgrimId,
    pilgrim: { fullName: `[DÉMO] ${pilgrimId}` },
    package: { endDate: d(fin) },
  };
}

describe('palierAtteint', () => {
  it('retient le plus haut palier atteint', () => {
    expect(palierAtteint(PALIERS, 0)).toBeUndefined();
    expect(palierAtteint(PALIERS, 2)?.label).toBe('[DÉMO] Bienvenue');
    expect(palierAtteint(PALIERS, 5)?.label).toBe('[DÉMO] Fidèle');
  });
});

describe('LoyaltyService', () => {
  let prisma: {
    agency: Record<string, jest.Mock>;
    booking: Record<string, jest.Mock>;
    loyaltyTier: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let service: LoyaltyService;

  beforeEach(() => {
    prisma = {
      agency: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'agence-1',
          legalName: '[DÉMO] Agence',
          loyaltyTiers: PALIERS,
        }),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      loyaltyTier: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new LoyaltyService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });

  it('refuse deux paliers au même seuil', async () => {
    await expect(
      service.replaceOwnTiers('proprietaire-1', {
        tiers: [
          { minTrips: 2, label: 'A', benefit: 'x' },
          { minTrips: 2, label: 'B', benefit: 'y' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('remplace les paliers de sa propre agence', async () => {
    await service.replaceOwnTiers('proprietaire-1', { tiers: PALIERS });
    expect(prisma.loyaltyTier.deleteMany).toHaveBeenCalledWith({
      where: { agencyId: 'agence-1' },
    });
    expect(prisma.loyaltyTier.createMany).toHaveBeenCalledWith({
      data: PALIERS.map((p) => ({ agencyId: 'agence-1', ...p })),
    });
  });

  it('classe les pèlerins par voyages effectués, avec leur palier', async () => {
    prisma.booking.findMany.mockResolvedValue([
      reservation('p1', '2025-03-01'),
      reservation('p2', '2026-03-01'),
      reservation('p1', '2026-02-01'),
      reservation('p1', '2024-01-01'),
    ]);

    const membres = await service.listMembers('proprietaire-1');

    expect(membres.map((m) => [m.pilgrimId, m.trips, m.tier?.label])).toEqual([
      ['p1', 3, '[DÉMO] Fidèle'],
      ['p2', 1, '[DÉMO] Bienvenue'],
    ]);
    expect(membres[0]?.lastTripEnd).toEqual(d('2026-02-01'));
    // Seuls les voyages effectués comptent.
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.agencyId).toBe('agence-1');
    expect(where.OR).toEqual([
      { status: 'completed' },
      { status: 'confirmed', package: { endDate: { lt: expect.any(Date) } } },
    ]);
  });

  it('donne au pèlerin son palier et le suivant, agence par agence', async () => {
    const agence = (nom: string, paliers: typeof PALIERS) => ({
      legalName: nom,
      loyaltyTiers: paliers,
    });
    prisma.booking.findMany.mockResolvedValue([
      { agencyId: 'a1', agency: agence('[DÉMO] A1', PALIERS) },
      { agencyId: 'a2', agency: agence('[DÉMO] A2', []) },
      { agencyId: 'a1', agency: agence('[DÉMO] A1', PALIERS) },
    ]);

    const mienne = await service.getMine('pelerin-1');

    expect(mienne[0]).toEqual({
      agencyId: 'a1',
      agencyName: '[DÉMO] A1',
      trips: 2,
      tier: PALIERS[0],
      nextTier: { ...PALIERS[1], tripsToGo: 1 },
    });
    expect(mienne[1]).toMatchObject({ agencyId: 'a2', trips: 1 });
    expect(mienne[1]?.tier).toBeUndefined();
    expect(mienne[1]?.nextTier).toBeUndefined();
    expect(prisma.booking.findMany.mock.calls[0][0].where.pilgrimId).toBe(
      'pelerin-1',
    );
  });
});
