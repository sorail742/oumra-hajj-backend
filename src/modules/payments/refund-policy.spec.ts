import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { eligibilite, joursAvantDepart, lirePaliers } from './refund-policy';
import { RefundPolicyService, verifierPaliers } from './refund-policy.service';

// Barème explicitement factice (idée #58).
const BAREME = [
  { minDaysBeforeDeparture: 60, rate: 0.9 },
  { minDaysBeforeDeparture: 30, rate: 0.5 },
  { minDaysBeforeDeparture: 7, rate: 0.2 },
];

describe('eligibilite (barème de remboursement)', () => {
  it('rembourse tout tant que la réservation n’est pas confirmée, rien une fois annulée ou terminée', () => {
    expect(eligibilite(BookingStatus.PENDING_PAYMENT, BAREME, 2)).toEqual({
      rate: 1,
      rule: 'unpaid_booking',
    });
    expect(eligibilite(BookingStatus.COMPLETED, BAREME, 90).rate).toBe(0);
    expect(eligibilite(BookingStatus.CANCELLED, BAREME, 90).rate).toBe(0);
  });

  it('applique le palier atteint le plus élevé, 0 % sous le dernier', () => {
    const taux = (jours: number) =>
      eligibilite(BookingStatus.CONFIRMED, BAREME, jours).rate;
    expect(taux(90)).toBe(0.9);
    expect(taux(60)).toBe(0.9);
    expect(taux(59)).toBe(0.5);
    expect(taux(7)).toBe(0.2);
    expect(taux(6)).toBe(0);
    expect(eligibilite(BookingStatus.CONFIRMED, BAREME, 3).rule).toBe(
      'not_refundable',
    );
  });

  it('retombe sur 50 % sans barème d’agence', () => {
    expect(eligibilite(BookingStatus.CONFIRMED, [], 10)).toEqual({
      rate: 0.5,
      rule: 'platform_default',
    });
  });

  it('compte les jours pleins avant le départ', () => {
    expect(
      joursAvantDepart(
        new Date('2026-11-10T00:00:00Z'),
        new Date('2026-10-11T12:00:00Z'),
      ),
    ).toBe(29);
  });

  it('ignore un barème figé mal formé', () => {
    expect(lirePaliers(null)).toEqual([]);
    expect(
      lirePaliers([{ minDaysBeforeDeparture: 30, rate: 0.5 }, { rate: 'x' }]),
    ).toEqual([{ minDaysBeforeDeparture: 30, rate: 0.5 }]);
  });
});

describe('verifierPaliers', () => {
  it('trie les paliers du plus lointain au plus proche', () => {
    expect(verifierPaliers([...BAREME].reverse())).toEqual(BAREME);
  });

  it('refuse deux paliers au même seuil ou un taux qui remonte près du départ', () => {
    expect(() =>
      verifierPaliers([
        { minDaysBeforeDeparture: 30, rate: 0.5 },
        { minDaysBeforeDeparture: 30, rate: 0.4 },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      verifierPaliers([
        { minDaysBeforeDeparture: 60, rate: 0.3 },
        { minDaysBeforeDeparture: 7, rate: 0.8 },
      ]),
    ).toThrow(BadRequestException);
  });
});

describe('RefundPolicyService', () => {
  let prisma: {
    refundPolicyTier: Record<string, jest.Mock>;
    booking: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: RefundPolicyService;

  beforeEach(() => {
    prisma = {
      refundPolicyTier: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockReturnValue('suppression'),
        createMany: jest.fn().mockReturnValue('creation'),
      },
      booking: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new RefundPolicyService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });

  it('remplace le barème de l’agence en une transaction', async () => {
    await service.replaceForOwner('proprietaire-1', { tiers: BAREME });

    expect(prisma.refundPolicyTier.deleteMany).toHaveBeenCalledWith({
      where: { agencyId: 'agence-1' },
    });
    expect(prisma.refundPolicyTier.createMany).toHaveBeenCalledWith({
      data: BAREME.map((p) => ({ agencyId: 'agence-1', ...p })),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'suppression',
      'creation',
    ]);
  });

  it('calcule le taux sur le barème figé à la réservation, pas sur le barème actuel', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      status: 'confirmed',
      refundPolicySnapshot: BAREME,
      package: { startDate: new Date('2026-11-20T00:00:00Z') },
    });

    const contexte = await service.contextFor(
      'resa-1',
      new Date('2026-10-01T00:00:00Z'),
    );

    expect(contexte).toEqual({
      rate: 0.5,
      rule: 'agency_tier',
      daysBeforeDeparture: 50,
      tiers: BAREME,
    });
    expect(prisma.refundPolicyTier.findMany).not.toHaveBeenCalled();
  });
});
