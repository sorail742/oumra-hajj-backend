import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { GuidePlanningService } from './guide-planning.service';
import { chevauche, conflits } from './planning';

// Planning explicitement factice (idée #42).
const d = (jour: string) => new Date(`${jour}T00:00:00Z`);

describe('planning — chevauchements', () => {
  it('compte les bornes comme incluses', () => {
    const a = { startDate: d('2026-12-01'), endDate: d('2026-12-10') };
    expect(
      chevauche(a, { startDate: d('2026-12-10'), endDate: d('2026-12-20') }),
    ).toBe(true);
    expect(
      chevauche(a, { startDate: d('2026-12-11'), endDate: d('2026-12-20') }),
    ).toBe(false);
  });

  it('signale chaque paire en conflit une seule fois, avec les jours communs', () => {
    const entrees = [
      {
        kind: 'group' as const,
        id: 'g1',
        label: 'G1',
        startDate: d('2026-12-01'),
        endDate: d('2026-12-15'),
      },
      {
        kind: 'unavailability' as const,
        id: 'u1',
        label: 'Congé',
        startDate: d('2026-12-10'),
        endDate: d('2026-12-20'),
      },
      {
        kind: 'group' as const,
        id: 'g2',
        label: 'G2',
        startDate: d('2027-01-05'),
        endDate: d('2027-01-20'),
      },
    ];
    expect(conflits(entrees)).toEqual([
      {
        firstId: 'g1',
        secondId: 'u1',
        startDate: d('2026-12-10'),
        endDate: d('2026-12-15'),
      },
    ]);
  });
});

describe('GuidePlanningService', () => {
  let prisma: {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    group: { findMany: jest.Mock };
    guideUnavailability: Record<string, jest.Mock>;
  };
  let service: GuidePlanningService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T10:00:00Z'));
    prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'guide-1', fullName: '[DÉMO] Guide Un' }]),
        findUnique: jest.fn(),
      },
      group: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'g1',
            title: '[DÉMO] Groupe décembre',
            guideId: 'guide-1',
            package: {
              title: '[DÉMO] Oumra',
              startDate: d('2026-12-01'),
              endDate: d('2026-12-15'),
            },
          },
        ]),
      },
      guideUnavailability: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            guideId: 'guide-1',
            reason: null,
            startDate: d('2026-12-14'),
            endDate: d('2026-12-20'),
          },
        ]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new GuidePlanningService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it("assemble groupes et indisponibilités de chaque guide de l'agence, conflits compris", async () => {
    const [planning] = await service.getAgencySchedule('proprio-1', {});

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId: 'agence-1', role: 'guide' },
      }),
    );
    // Fenêtre par défaut : d'aujourd'hui à dans un an.
    expect(prisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          guideId: { in: ['guide-1'] },
          package: {
            startDate: { lte: d('2027-10-08') },
            endDate: { gte: d('2026-10-08') },
          },
        },
      }),
    );
    expect(planning?.entries.map((e) => [e.kind, e.label])).toEqual([
      ['group', '[DÉMO] Groupe décembre'],
      ['unavailability', 'Indisponible'],
    ]);
    expect(planning?.conflicts).toHaveLength(1);
  });

  it("refuse une indisponibilité pour un guide d'une autre agence ou inversée", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'guide-9',
      fullName: 'X',
      role: 'guide',
      agencyId: 'agence-2',
    });
    await expect(
      service.addUnavailability('proprio-1', {
        guideId: 'guide-9',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({
      id: 'guide-1',
      fullName: 'X',
      role: 'guide',
      agencyId: 'agence-1',
    });
    await expect(
      service.addUnavailability('proprio-1', {
        guideId: 'guide-1',
        startDate: '2026-11-05',
        endDate: '2026-11-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.guideUnavailability.create).not.toHaveBeenCalled();
  });

  it("ne supprime qu'une indisponibilité de l'agence", async () => {
    await service.deleteUnavailability('proprio-1', 'u1');
    expect(prisma.guideUnavailability.deleteMany).toHaveBeenCalledWith({
      where: { id: 'u1', agencyId: 'agence-1' },
    });
  });
});
