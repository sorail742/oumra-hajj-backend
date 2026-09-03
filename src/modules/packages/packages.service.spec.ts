import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PackageStatus } from '../../common/enums/package-status.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { PackagesService } from './packages.service';

describe('PackagesService — gestion des places (capacité forfait)', () => {
  let service: PackagesService;
  let prisma: {
    package: { findUnique: jest.Mock; update: jest.Mock };
  };

  const buildPkg = (
    overrides: Partial<{
      capacity: number;
      seatsTaken: number;
      status: string;
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
    hotelName: null,
    hotelCity: null,
    hotelDistanceToMosqueM: null,
    inclusions: [],
    status: 'open',
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      package: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgenciesService, useValue: {} },
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
});
