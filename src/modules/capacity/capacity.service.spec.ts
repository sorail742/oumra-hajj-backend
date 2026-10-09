import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { CapacityService } from './capacity.service';

// Données explicitement factices (idée #68).
const d = (iso: string) => new Date(iso);

function forfait(
  id: string,
  debut: string,
  fin: string,
  capacity: number,
  seatsTaken: number,
  guideIds: (string | null)[] = [],
) {
  return {
    id,
    title: `[DÉMO] Voyage ${id}`,
    startDate: d(debut),
    endDate: d(fin),
    capacity,
    seatsTaken,
    groups: guideIds.map((guideId) => ({ guideId })),
  };
}

describe('CapacityService', () => {
  let prisma: {
    user: Record<string, jest.Mock>;
    package: Record<string, jest.Mock>;
  };
  let service: CapacityService;

  beforeEach(() => {
    prisma = {
      user: { count: jest.fn().mockResolvedValue(3) },
      package: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CapacityService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });

  it('sans voyage à venir, tout le staff est disponible', async () => {
    const r = await service.simulate('proprietaire-1', {});
    expect(r.pilgrimsPerGuide).toBe(40);
    expect(r.peak).toBeUndefined();
    expect(r.spareGuidesAtPeak).toBe(3);
    expect(r.extraPilgrimsAtPeak).toBe(120);
  });

  it('additionne les guides par voyage quand les voyages se chevauchent', async () => {
    prisma.package.findMany.mockResolvedValue([
      // 50 places → 2 guides ; 30 places → 1 guide (ratio 40).
      forfait('a', '2026-11-01T00:00:00Z', '2026-11-10T00:00:00Z', 50, 45, [
        'g1',
        'g1',
        null,
      ]),
      forfait('b', '2026-11-08T00:00:00Z', '2026-11-20T00:00:00Z', 30, 10),
    ]);

    const r = await service.simulate('proprietaire-1', {});

    expect(r.trips.map((t) => [t.guidesNeeded, t.guidesAssigned])).toEqual([
      [2, 1],
      [1, 0],
    ]);
    expect(r.periods.map((p) => p.packageIds)).toEqual([
      ['a'],
      ['a', 'b'],
      ['b'],
    ]);
    expect(r.peak).toMatchObject({
      from: d('2026-11-08T00:00:00Z'),
      to: d('2026-11-11T00:00:00Z'),
      plannedPilgrims: 80,
      soldPilgrims: 55,
      guidesNeeded: 3,
      guidesNeededForSold: 3,
    });
    expect(r.spareGuidesAtPeak).toBe(0);
    expect(r.extraPilgrimsAtPeak).toBe(0);
  });

  it('montre le manque de guides et l’effet de recrues hypothétiques', async () => {
    prisma.package.findMany.mockResolvedValue([
      forfait('a', '2026-11-01T00:00:00Z', '2026-11-10T00:00:00Z', 200, 0),
    ]);

    const sans = await service.simulate('proprietaire-1', {
      pilgrimsPerGuide: 25,
    });
    expect(sans.peak?.guidesNeeded).toBe(8);
    expect(sans.spareGuidesAtPeak).toBe(-5);
    expect(sans.extraPilgrimsAtPeak).toBe(0);

    const avec = await service.simulate('proprietaire-1', {
      pilgrimsPerGuide: 25,
      extraGuides: 6,
    });
    expect(avec.staff).toBe(9);
    expect(avec.spareGuidesAtPeak).toBe(1);
    expect(avec.extraPilgrimsAtPeak).toBe(25);
  });

  it('ne compte que les guides actifs de l’agence', async () => {
    await service.simulate('proprietaire-1', {});
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { agencyId: 'agence-1', role: 'guide', isActive: true },
    });
  });
});
