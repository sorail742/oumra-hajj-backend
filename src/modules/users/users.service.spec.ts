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

  describe('findById', () => {
    it("renvoie l'utilisateur sans passwordHash quand il existe", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const user = await service.findById('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(user?.id).toBe('user-1');
    });

    it('renvoie null si aucun utilisateur ne correspond', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const user = await service.findById('unknown');

      expect(user).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it("lève NotFoundException si l'utilisateur n'existe pas", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdOrFail('unknown')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("renvoie l'utilisateur quand il existe", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const user = await service.findByIdOrFail('user-1');

      expect(user.id).toBe('user-1');
    });
  });

  describe('findByPhone', () => {
    it('cherche par numéro de téléphone tel quel', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const user = await service.findByPhone('+224620000000');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+224620000000' },
      });
      expect(user?.id).toBe('user-1');
    });
  });

  describe('findByEmail', () => {
    it("normalise l'email en minuscules avant la recherche", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        email: 'agence@example.gn',
      });

      const user = await service.findByEmail('Agence@Example.GN');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'agence@example.gn' },
      });
      expect(user?.email).toBe('agence@example.gn');
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

  describe('setActive', () => {
    it('suspend un utilisateur', async () => {
      prisma.user.update.mockResolvedValue({ ...baseUser, isActive: false });

      const user = await service.setActive('user-1', false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
      expect(user.isActive).toBe(false);
    });

    it('réactive un utilisateur', async () => {
      prisma.user.update.mockResolvedValue({ ...baseUser, isActive: true });

      const user = await service.setActive('user-1', true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: true },
      });
      expect(user.isActive).toBe(true);
    });

    it("lève NotFoundException si l'utilisateur n'existe pas", async () => {
      prisma.user.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.setActive('unknown', true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
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
