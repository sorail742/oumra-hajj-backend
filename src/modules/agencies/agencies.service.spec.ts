import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AgenciesService } from './agencies.service';
import { Agency, AgencyValidationStatus } from './schemas/agency.schema';

describe('AgenciesService — inscription et validation des agences', () => {
  let service: AgenciesService;
  let agencyModel: { create: jest.Mock; findById: jest.Mock };
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    agencyModel = { create: jest.fn(), findById: jest.fn() };
    usersService = { findByEmail: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenciesService,
        { provide: getModelToken(Agency.name), useValue: agencyModel },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(AgenciesService);
  });

  describe('register', () => {
    it('refuse une inscription avec un email déjà utilisé', async () => {
      usersService.findByEmail.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.register({
          legalName: 'Agence Test',
          contactEmail: 'contact@agence-test.gn',
          contactPhone: '+224620000000',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(agencyModel.create).not.toHaveBeenCalled();
    });

    it("crée l'utilisateur agence (rôle AGENCY, mot de passe hashé) puis l'agence en statut PENDING", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const ownerId = new Types.ObjectId();
      usersService.create.mockResolvedValue({ _id: ownerId });
      agencyModel.create.mockResolvedValue({ _id: new Types.ObjectId() });

      await service.register({
        legalName: 'Agence Test',
        contactEmail: 'contact@agence-test.gn',
        contactPhone: '+224620000000',
        password: 'password123',
      });

      const createUserArg = usersService.create.mock.calls[0][0];
      expect(createUserArg.role).toBe(Role.AGENCY);
      expect(createUserArg.passwordHash).not.toBe('password123');

      expect(agencyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: ownerId,
          validationStatus: AgencyValidationStatus.PENDING,
        }),
      );
    });
  });

  describe('assertApproved', () => {
    it("rejette une agence dont le statut n'est pas APPROVED", async () => {
      agencyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          validationStatus: AgencyValidationStatus.PENDING,
        }),
      });

      await expect(service.assertApproved('agency-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('laisse passer une agence APPROVED', async () => {
      agencyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          validationStatus: AgencyValidationStatus.APPROVED,
        }),
      });

      await expect(service.assertApproved('agency-1')).resolves.toBeUndefined();
    });
  });

  describe('approve / reject', () => {
    it("marque l'agence APPROVED et efface un précédent motif de rejet", async () => {
      const agency = {
        validationStatus: AgencyValidationStatus.REJECTED,
        rejectionReason: 'documents incomplets',
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      agencyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(agency),
      });

      const result = await service.approve(
        'agency-1',
        new Types.ObjectId().toString(),
      );

      expect(result.validationStatus).toBe(AgencyValidationStatus.APPROVED);
      expect(result.rejectionReason).toBeUndefined();
    });

    it("marque l'agence REJECTED avec le motif fourni", async () => {
      const agency = {
        validationStatus: AgencyValidationStatus.PENDING,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      agencyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(agency),
      });

      const result = await service.reject(
        'agency-1',
        new Types.ObjectId().toString(),
        'documents illisibles',
      );

      expect(result.validationStatus).toBe(AgencyValidationStatus.REJECTED);
      expect(result.rejectionReason).toBe('documents illisibles');
    });
  });
});
