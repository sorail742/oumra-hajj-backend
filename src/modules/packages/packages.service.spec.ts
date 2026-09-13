import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PackageStatus } from '../../common/enums/package-status.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { PackagesService } from './packages.service';

describe('PackagesService — gestion des places (capacité forfait)', () => {
  let service: PackagesService;
  let prisma: {
    package: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let agenciesService: {
    findByOwnerOrFail: jest.Mock;
    assertApproved: jest.Mock;
  };

  const buildPkg = (
    overrides: Partial<{
      capacity: number;
      seatsTaken: number;
      status: string;
      stages: Array<{
        id: string;
        city: string;
        hotelName: string;
        distanceToMosqueMeters?: number;
        startDate: Date;
        endDate: Date;
      }>;
    }>,
  ) => ({
    id: 'pkg-1',
    agencyId: 'agency-1',
    type: 'oumra',
    title: 'Oumra Ramadan',
    description: null,
    startDate: new Date('2027-03-01'),
    endDate: new Date('2027-03-15'),
    price: 500,
    currency: 'GNF',
    capacity: 10,
    seatsTaken: 0,
    stages: [],
    inclusions: [],
    status: 'open',
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      package: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    agenciesService = {
      findByOwnerOrFail: jest.fn(),
      assertApproved: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgenciesService, useValue: agenciesService },
      ],
    }).compile();

    service = module.get(PackagesService);
  });

  describe('reserveSeat', () => {
    it('incrémente le nombre de places prises quand il reste de la place', async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 3 }),
      );
      prisma.package.update.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 4 }),
      );

      const result = await service.reserveSeat('pkg-1');

      expect(result.seatsTaken).toBe(4);
      expect(result.status).toBe(PackageStatus.OPEN);
    });

    it('passe le forfait à FULL dès que la dernière place est prise', async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 9 }),
      );
      prisma.package.update.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 10, status: 'full' }),
      );

      const result = await service.reserveSeat('pkg-1');

      expect(result.seatsTaken).toBe(10);
      expect(result.status).toBe(PackageStatus.FULL);
    });

    it('refuse une réservation quand le forfait est déjà complet', async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 10, status: 'open' }),
      );
      prisma.package.update.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 10, status: 'full' }),
      );

      await expect(service.reserveSeat('pkg-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.package.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PackageStatus.FULL }),
        }),
      );
    });

    it('refuse une réservation sur un forfait fermé ou déjà complet (statut non OPEN)', async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ status: 'closed' }),
      );

      await expect(service.reserveSeat('pkg-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.package.update).not.toHaveBeenCalled();
    });
  });

  describe('releaseSeat', () => {
    it('décrémente le nombre de places prises', async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 4 }),
      );
      prisma.package.update.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 3 }),
      );

      const result = await service.releaseSeat('pkg-1');

      expect(result.seatsTaken).toBe(3);
    });

    it('ne descend jamais sous zéro', async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 0 }),
      );
      prisma.package.update.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 0 }),
      );

      const result = await service.releaseSeat('pkg-1');

      expect(result.seatsTaken).toBe(0);
    });

    it("rouvre un forfait FULL dès qu'une place se libère", async () => {
      prisma.package.findUnique.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 10, status: 'full' }),
      );
      prisma.package.update.mockResolvedValue(
        buildPkg({ capacity: 10, seatsTaken: 9, status: 'open' }),
      );

      const result = await service.releaseSeat('pkg-1');

      expect(result.seatsTaken).toBe(9);
      expect(result.status).toBe(PackageStatus.OPEN);
    });
  });

  describe('create — étapes multiples', () => {
    const ownerId = 'owner-1';

    beforeEach(() => {
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });
      agenciesService.assertApproved.mockResolvedValue(undefined);
    });

    it('crée les étapes en une seule écriture imbriquée, triées par date', async () => {
      prisma.package.create.mockResolvedValue(
        buildPkg({
          stages: [
            {
              id: 'stage-medine',
              city: 'Médine',
              hotelName: 'Hôtel Al Ansar',
              distanceToMosqueMeters: 200,
              startDate: new Date('2027-03-01'),
              endDate: new Date('2027-03-05'),
            },
            {
              id: 'stage-mecque',
              city: 'La Mecque',
              hotelName: 'Hôtel Al Safwah',
              distanceToMosqueMeters: 350,
              startDate: new Date('2027-03-05'),
              endDate: new Date('2027-03-15'),
            },
          ],
        }),
      );

      const result = await service.create(ownerId, {
        type: 'oumra' as never,
        title: 'Oumra Ramadan',
        startDate: '2027-03-01',
        endDate: '2027-03-15',
        price: 500,
        capacity: 10,
        stages: [
          {
            city: 'Médine',
            hotelName: 'Hôtel Al Ansar',
            distanceToMosqueMeters: 200,
            startDate: '2027-03-01',
            endDate: '2027-03-05',
          },
          {
            city: 'La Mecque',
            hotelName: 'Hôtel Al Safwah',
            distanceToMosqueMeters: 350,
            startDate: '2027-03-05',
            endDate: '2027-03-15',
          },
        ],
      });

      expect(prisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stages: {
              create: [
                expect.objectContaining({
                  city: 'Médine',
                  hotelName: 'Hôtel Al Ansar',
                  distanceToMosqueMeters: 200,
                }),
                expect.objectContaining({
                  city: 'La Mecque',
                  hotelName: 'Hôtel Al Safwah',
                  distanceToMosqueMeters: 350,
                }),
              ],
            },
          }),
          include: { stages: { orderBy: { startDate: 'asc' } } },
        }),
      );
      expect(result.stages).toHaveLength(2);
      expect(result.stages[0].city).toBe('Médine');
      expect(result.stages[1].city).toBe('La Mecque');
    });
  });

  describe('update — remplacement des étapes', () => {
    const ownerId = 'owner-1';

    beforeEach(() => {
      prisma.package.findUnique.mockResolvedValue(buildPkg({}));
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });
    });

    it('remplace intégralement les étapes existantes (deleteMany + create)', async () => {
      prisma.package.update.mockResolvedValue(
        buildPkg({
          stages: [
            {
              id: 'stage-nouvelle',
              city: 'La Mecque',
              hotelName: 'Nouvel hôtel',
              distanceToMosqueMeters: 100,
              startDate: new Date('2027-03-01'),
              endDate: new Date('2027-03-15'),
            },
          ],
        }),
      );

      await service.update(ownerId, 'pkg-1', {
        stages: [
          {
            city: 'La Mecque',
            hotelName: 'Nouvel hôtel',
            distanceToMosqueMeters: 100,
            startDate: '2027-03-01',
            endDate: '2027-03-15',
          },
        ],
      });

      expect(prisma.package.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stages: {
              deleteMany: {},
              create: [
                expect.objectContaining({
                  city: 'La Mecque',
                  hotelName: 'Nouvel hôtel',
                }),
              ],
            },
          }),
        }),
      );
    });

    it("ne touche pas aux étapes si le DTO n'en fournit pas", async () => {
      prisma.package.update.mockResolvedValue(buildPkg({}));

      await service.update(ownerId, 'pkg-1', { title: 'Nouveau titre' });

      expect(prisma.package.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ stages: expect.anything() }),
        }),
      );
    });
  });

  // Idée #10 (backlog "Cent Fonctionnalités") — recommandation de forfait.
  describe('listPublic — recommandation (budget, dates, taille du groupe)', () => {
    it('filtre sur le budget maximum et trie par prix croissant', async () => {
      prisma.package.findMany.mockResolvedValue([
        buildPkg({ capacity: 10, seatsTaken: 0 }),
      ]);

      await service.listPublic({ maxBudget: 800 });

      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ price: { lte: 800 } }),
          orderBy: { price: 'asc' },
        }),
      );
    });

    it('garde le tri chronologique par défaut sans budget renseigné', async () => {
      prisma.package.findMany.mockResolvedValue([]);

      await service.listPublic({});

      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startDate: 'asc' } }),
      );
    });

    it('filtre sur la fenêtre de dates de départ', async () => {
      prisma.package.findMany.mockResolvedValue([]);

      await service.listPublic({
        startDateFrom: '2027-03-01',
        startDateTo: '2027-06-01',
      });

      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: {
              gte: new Date('2027-03-01'),
              lte: new Date('2027-06-01'),
            },
          }),
        }),
      );
    });

    it('écarte après coup les forfaits sans assez de places restantes pour le groupe', async () => {
      prisma.package.findMany.mockResolvedValue([
        buildPkg({ capacity: 10, seatsTaken: 8 }), // 2 places restantes
        buildPkg({ capacity: 10, seatsTaken: 2 }), // 8 places restantes
      ]);

      const result = await service.listPublic({ familySize: 5 });

      expect(result).toHaveLength(1);
      expect(result[0].seatsTaken).toBe(2);
    });
  });
});
