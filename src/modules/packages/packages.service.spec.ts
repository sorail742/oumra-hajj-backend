import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AgenciesService } from '../agencies/agencies.service';
import { PackagesService } from './packages.service';
import { Package, PackageStatus } from './schemas/package.schema';

describe('PackagesService — gestion des places (capacité forfait)', () => {
  let service: PackagesService;
  let packageModel: { findById: jest.Mock };

  const buildPkg = (
    overrides: Partial<{
      capacity: number;
      seatsTaken: number;
      status: PackageStatus;
    }>,
  ) => ({
    capacity: 10,
    seatsTaken: 0,
    status: PackageStatus.OPEN,
    save: jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    ...overrides,
  });

  beforeEach(async () => {
    packageModel = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: getModelToken(Package.name), useValue: packageModel },
        { provide: AgenciesService, useValue: {} },
      ],
    }).compile();

    service = module.get(PackagesService);
  });

  describe('reserveSeat', () => {
    it('incrémente le nombre de places prises quand il reste de la place', async () => {
      const pkg = buildPkg({ capacity: 10, seatsTaken: 3 });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      const result = await service.reserveSeat('pkg-1');

      expect(result.seatsTaken).toBe(4);
      expect(result.status).toBe(PackageStatus.OPEN);
    });

    it('passe le forfait à FULL dès que la dernière place est prise', async () => {
      const pkg = buildPkg({ capacity: 10, seatsTaken: 9 });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      const result = await service.reserveSeat('pkg-1');

      expect(result.seatsTaken).toBe(10);
      expect(result.status).toBe(PackageStatus.FULL);
    });

    it('refuse une réservation quand le forfait est déjà complet', async () => {
      const pkg = buildPkg({
        capacity: 10,
        seatsTaken: 10,
        status: PackageStatus.OPEN,
      });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      await expect(service.reserveSeat('pkg-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(pkg.status).toBe(PackageStatus.FULL);
    });

    it('refuse une réservation sur un forfait fermé ou déjà complet (statut non OPEN)', async () => {
      const pkg = buildPkg({ status: PackageStatus.CLOSED });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      await expect(service.reserveSeat('pkg-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(pkg.save).not.toHaveBeenCalled();
    });
  });

  describe('releaseSeat', () => {
    it('décrémente le nombre de places prises', async () => {
      const pkg = buildPkg({ capacity: 10, seatsTaken: 4 });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      const result = await service.releaseSeat('pkg-1');

      expect(result.seatsTaken).toBe(3);
    });

    it('ne descend jamais sous zéro', async () => {
      const pkg = buildPkg({ capacity: 10, seatsTaken: 0 });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      const result = await service.releaseSeat('pkg-1');

      expect(result.seatsTaken).toBe(0);
    });

    it("rouvre un forfait FULL dès qu'une place se libère", async () => {
      const pkg = buildPkg({
        capacity: 10,
        seatsTaken: 10,
        status: PackageStatus.FULL,
      });
      packageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      const result = await service.releaseSeat('pkg-1');

      expect(result.seatsTaken).toBe(9);
      expect(result.status).toBe(PackageStatus.OPEN);
    });
  });
});
