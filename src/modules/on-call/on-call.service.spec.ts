import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { OnCallService, trousDeCouverture } from './on-call.service';

// Données explicitement factices (idée #63).
const d = (iso: string) => new Date(iso);
const CRENEAU_ID = '22222222-2222-4222-8222-222222222222';

function creneau(surcharge: Record<string, unknown> = {}) {
  return {
    id: CRENEAU_ID,
    agencyId: 'agence-1',
    packageId: null,
    package: null,
    staffName: '[DÉMO] Coordinateur fictif',
    staffRole: 'coordinator',
    phone: '+224620000000',
    startsAt: d('2026-11-01T08:00:00Z'),
    endsAt: d('2026-11-01T20:00:00Z'),
    notes: null,
    ...surcharge,
  };
}

describe('trousDeCouverture', () => {
  const debut = d('2026-11-01T00:00:00Z');
  const fin = d('2026-11-02T00:00:00Z');

  it('voit tout le séjour à découvert sans créneau', () => {
    expect(trousDeCouverture(debut, fin, [])).toEqual([
      { from: debut, to: fin },
    ]);
  });

  it('fusionne les créneaux qui se chevauchent et garde les trous', () => {
    const trous = trousDeCouverture(debut, fin, [
      {
        startsAt: d('2026-11-01T12:00:00Z'),
        endsAt: d('2026-11-01T20:00:00Z'),
      },
      {
        startsAt: d('2026-10-31T20:00:00Z'),
        endsAt: d('2026-11-01T08:00:00Z'),
      },
      {
        startsAt: d('2026-11-01T18:00:00Z'),
        endsAt: d('2026-11-01T22:00:00Z'),
      },
    ]);
    expect(trous).toEqual([
      { from: d('2026-11-01T08:00:00Z'), to: d('2026-11-01T12:00:00Z') },
      { from: d('2026-11-01T22:00:00Z'), to: fin },
    ]);
  });

  it("ne voit aucun trou quand l'astreinte déborde du séjour", () => {
    expect(
      trousDeCouverture(debut, fin, [
        {
          startsAt: d('2026-10-31T00:00:00Z'),
          endsAt: d('2026-11-03T00:00:00Z'),
        },
      ]),
    ).toEqual([]);
  });
});

describe('OnCallService', () => {
  let prisma: {
    onCallShift: Record<string, jest.Mock>;
    package: Record<string, jest.Mock>;
    booking: Record<string, jest.Mock>;
  };
  let service: OnCallService;

  beforeEach(() => {
    prisma = {
      onCallShift: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(creneau()),
        create: jest.fn().mockResolvedValue(creneau()),
        update: jest.fn().mockResolvedValue(creneau()),
        delete: jest.fn(),
      },
      package: {
        findUnique: jest.fn().mockResolvedValue({
          agencyId: 'agence-1',
          title: '[DÉMO] Oumra fictive',
          startDate: d('2026-11-01T00:00:00Z'),
          endDate: d('2026-11-02T00:00:00Z'),
        }),
      },
      booking: { findUnique: jest.fn() },
    };
    service = new OnCallService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });

  const dto = {
    staffName: '[DÉMO] Coordinateur fictif',
    staffRole: 'coordinator' as const,
    phone: '+224620000000',
    startsAt: '2026-11-01T08:00:00Z',
    endsAt: '2026-11-01T20:00:00Z',
  };

  it('refuse un créneau qui finit avant de commencer', async () => {
    await expect(
      service.createShift('proprietaire-1', {
        ...dto,
        endsAt: '2026-11-01T07:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onCallShift.create).not.toHaveBeenCalled();
  });

  it('refuse un créneau de plus de 14 jours', async () => {
    await expect(
      service.createShift('proprietaire-1', {
        ...dto,
        endsAt: '2026-11-20T08:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuse le forfait d'une autre agence", async () => {
    prisma.package.findUnique.mockResolvedValue({
      agencyId: 'agence-2',
      title: 'x',
      startDate: d('2026-11-01T00:00:00Z'),
      endDate: d('2026-11-02T00:00:00Z'),
    });
    await expect(
      service.createShift('proprietaire-1', { ...dto, packageId: 'forfait-9' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse de modifier le créneau d'une autre agence", async () => {
    prisma.onCallShift.findUnique.mockResolvedValue(
      creneau({ agencyId: 'agence-2' }),
    );
    await expect(
      service.updateShift('proprietaire-1', CRENEAU_ID, { staffName: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onCallShift.update).not.toHaveBeenCalled();
  });

  it('revalide la période avec les dates déjà enregistrées', async () => {
    await expect(
      service.updateShift('proprietaire-1', CRENEAU_ID, {
        startsAt: '2026-11-01T21:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("mesure la couverture jusqu'à minuit du dernier jour", async () => {
    prisma.onCallShift.findMany.mockResolvedValue([
      {
        startsAt: d('2026-11-01T00:00:00Z'),
        endsAt: d('2026-11-02T12:00:00Z'),
      },
    ]);

    const couverture = await service.getCoverage('proprietaire-1', 'forfait-1');

    expect(couverture.totalHours).toBe(48);
    expect(couverture.coveredHours).toBe(36);
    expect(couverture.gaps).toEqual([
      { from: d('2026-11-02T12:00:00Z'), to: d('2026-11-03T00:00:00Z') },
    ]);
  });

  describe('vue pèlerin', () => {
    const reservation = {
      id: 'resa-1',
      pilgrimId: 'pelerin-1',
      agencyId: 'agence-1',
      packageId: 'forfait-1',
      status: 'confirmed',
      agency: {
        legalName: '[DÉMO] Agence fictive',
        contactPhone: '+224600000000',
      },
    };

    it("refuse la réservation d'un autre pèlerin", async () => {
      prisma.booking.findUnique.mockResolvedValue(reservation);
      await expect(
        service.getForBooking('pelerin-2', 'resa-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.onCallShift.findMany).not.toHaveBeenCalled();
    });

    it('sépare les contacts en cours du prochain, sans les notes internes', async () => {
      prisma.booking.findUnique.mockResolvedValue(reservation);
      const maintenant = Date.now();
      prisma.onCallShift.findMany.mockResolvedValue([
        creneau({
          startsAt: new Date(maintenant - 3600_000),
          endsAt: new Date(maintenant + 3600_000),
          notes: 'consigne interne',
        }),
        creneau({
          staffName: '[DÉMO] Guide fictif',
          staffRole: 'guide',
          startsAt: new Date(maintenant + 3600_000),
          endsAt: new Date(maintenant + 7200_000),
        }),
      ]);

      const vue = await service.getForBooking('pelerin-1', 'resa-1');

      expect(vue.agencyPhone).toBe('+224600000000');
      expect(vue.current).toHaveLength(1);
      expect(vue.current[0]).not.toHaveProperty('notes');
      expect(vue.next?.staffName).toBe('[DÉMO] Guide fictif');
      expect(prisma.onCallShift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ packageId: 'forfait-1' }, { packageId: null }],
          }),
        }),
      );
    });
  });
});
