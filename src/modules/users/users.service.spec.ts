import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const baseUser = {
    id: 'user-1',
    fullName: 'Amadou Diallo',
    phone: '+224620000000',
    email: null,
    role: 'pilgrim',
    preferredLanguage: 'fr',
    bloodType: null,
    passportNumber: null,
    isActive: true,
    agencyId: null,
    emergencyContactFullName: null,
    emergencyContactPhone: null,
    emergencyContactRelationship: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('create', () => {
    it('crée un utilisateur et ne renvoie jamais passwordHash', async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      const user = await service.create({
        fullName: 'Amadou Diallo',
        phone: '+224620000000',
        role: Role.PILGRIM,
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fullName: 'Amadou Diallo' }),
        }),
      );
      expect(user).not.toHaveProperty('passwordHash');
      expect(user.id).toBe('user-1');
    });
  });

  describe('findByEmailWithPassword', () => {
    it('demande explicitement passwordHash via omit: false', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        email: 'agence@example.gn',
        passwordHash: 'hashed',
      });

      const user = await service.findByEmailWithPassword('agence@example.gn');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'agence@example.gn' },
        omit: { passwordHash: false },
      });
      expect(user?.passwordHash).toBe('hashed');
    });
  });

  describe('updateProfile', () => {
    it('aplatit emergencyContact vers les colonnes Postgres et le renvoie imbriqué', async () => {
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        emergencyContactFullName: 'Fatou Diallo',
        emergencyContactPhone: '+224620000099',
        emergencyContactRelationship: 'Épouse',
      });

      const user = await service.updateProfile('user-1', {
        emergencyContact: {
          fullName: 'Fatou Diallo',
          phone: '+224620000099',
          relationship: 'Épouse',
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          emergencyContactFullName: 'Fatou Diallo',
          emergencyContactPhone: '+224620000099',
          emergencyContactRelationship: 'Épouse',
        },
      });
      expect(user.emergencyContact).toEqual({
        fullName: 'Fatou Diallo',
        phone: '+224620000099',
        relationship: 'Épouse',
      });
    });

    it("lève NotFoundException si l'utilisateur n'existe pas", async () => {
      prisma.user.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.updateProfile('unknown', { fullName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findByRole', () => {
    it('filtre par rôle et par agence quand fournie', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      const users = await service.findByRole(Role.GUIDE, 'agency-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: Role.GUIDE, agencyId: 'agency-1' },
      });
      expect(users).toHaveLength(1);
    });
  });
});
