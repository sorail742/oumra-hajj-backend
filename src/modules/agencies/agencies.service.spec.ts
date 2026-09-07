import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AgenciesService } from './agencies.service';

describe('AgenciesService — inscription et validation des agences', () => {
  let service: AgenciesService;
  let prisma: {
    agency: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };

  const baseAgency = {
    id: 'agency-1',
    legalName: 'Agence Test',
    ownerId: 'owner-1',
    contactEmail: 'contact@agence-test.gn',
    contactPhone: '+224620000000',
    address: null,
    validationStatus: 'pending',
    rejectionReason: null,
    validatedById: null,
    validatedAt: null,
    commissionRate: 0,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    legalDocuments: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      agency: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    usersService = { findByEmail: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenciesService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(AgenciesService);
  });

  describe('register', () => {
    it('refuse une inscription avec un email déjà utilisé', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          legalName: 'Agence Test',
          contactEmail: 'contact@agence-test.gn',
          contactPhone: '+224620000000',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(prisma.agency.create).not.toHaveBeenCalled();
    });

    it("crée l'utilisateur agence (rôle AGENCY, mot de passe hashé) puis l'agence en statut PENDING", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ id: 'owner-1' });
      prisma.agency.create.mockResolvedValue(baseAgency);

      const agency = await service.register({
        legalName: 'Agence Test',
        contactEmail: 'contact@agence-test.gn',
        contactPhone: '+224620000000',
        password: 'password123',
      });

      const createUserArg = usersService.create.mock.calls[0][0];
      expect(createUserArg.role).toBe(Role.AGENCY);
      expect(createUserArg.passwordHash).not.toBe('password123');

      expect(prisma.agency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'owner-1',
            validationStatus: AgencyValidationStatus.PENDING,
          }),
        }),
      );
      expect(agency.id).toBe('agency-1');
      expect(agency.validationStatus).toBe(AgencyValidationStatus.PENDING);
    });
  });

  describe('assertApproved', () => {
    it("rejette une agence dont le statut n'est pas APPROVED", async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'pending',
      });

      await expect(service.assertApproved('agency-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('laisse passer une agence APPROVED', async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'approved',
      });

      await expect(service.assertApproved('agency-1')).resolves.toBeUndefined();
    });
  });

  describe('approve / reject', () => {
    it("marque l'agence APPROVED et efface un précédent motif de rejet", async () => {
      prisma.agency.update.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'approved',
        rejectionReason: null,
      });

      const result = await service.approve('agency-1', 'admin-1');

      expect(prisma.agency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agency-1' },
          data: expect.objectContaining({
            validationStatus: AgencyValidationStatus.APPROVED,
            validatedById: 'admin-1',
            rejectionReason: null,
          }),
        }),
      );
      expect(result.validationStatus).toBe(AgencyValidationStatus.APPROVED);
      expect(result.rejectionReason).toBeUndefined();
    });

    it("marque l'agence REJECTED avec le motif fourni", async () => {
      prisma.agency.update.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'rejected',
        rejectionReason: 'documents illisibles',
      });

      const result = await service.reject(
        'agency-1',
        'admin-1',
        'documents illisibles',
      );

      expect(result.validationStatus).toBe(AgencyValidationStatus.REJECTED);
      expect(result.rejectionReason).toBe('documents illisibles');
    });

    it("lève NotFoundException si l'agence n'existe pas", async () => {
      prisma.agency.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.approve('unknown', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
