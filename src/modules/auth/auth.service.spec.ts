import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { OTP_SENDER } from './otp/otp-sender.interface';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    otp: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let usersService: {
    findByPhone: jest.Mock;
    create: jest.Mock;
    findByEmailWithPassword: jest.Mock;
    findByIdOrFail: jest.Mock;
  };
  let otpSender: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      otp: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    usersService = {
      findByPhone: jest.fn(),
      create: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findByIdOrFail: jest.fn(),
    };
    otpSender = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed-token'),
            decode: jest
              .fn()
              .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'otp') return { ttlSeconds: 300, codeLength: 6 };
              if (key === 'jwt')
                return {
                  accessSecret: 'a',
                  accessExpiresIn: '15m',
                  refreshSecret: 'r',
                  refreshExpiresIn: '30d',
                };
              return undefined;
            }),
          },
        },
        { provide: OTP_SENDER, useValue: otpSender },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('requestOtp', () => {
    it("génère un code, le hashe, purge les anciens codes et l'envoie via le provider OTP", async () => {
      await service.requestOtp('+224620000000');

      expect(prisma.otp.deleteMany).toHaveBeenCalledWith({
        where: { phone: '+224620000000' },
      });
      expect(prisma.otp.create).toHaveBeenCalledTimes(1);
      const createArg = prisma.otp.create.mock.calls[0][0].data;
      expect(createArg.phone).toBe('+224620000000');
      expect(createArg.codeHash).not.toBe(createArg.code);
      expect(otpSender.send).toHaveBeenCalledWith(
        '+224620000000',
        expect.any(String),
      );
    });
  });

  describe('verifyOtp', () => {
    it("rejette un code lorsque aucun OTP actif n'existe pour ce numéro", async () => {
      prisma.otp.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyOtp('+224620000000', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejette un code expiré même si le hash correspond', async () => {
      const bcrypt = await import('bcrypt');
      const codeHash = await bcrypt.hash('123456', 4);
      prisma.otp.findFirst.mockResolvedValue({
        id: 'otp-1',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyOtp('+224620000000', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('crée un nouveau pèlerin et émet des jetons lorsque le code est valide', async () => {
      const bcrypt = await import('bcrypt');
      const codeHash = await bcrypt.hash('123456', 4);
      prisma.otp.findFirst.mockResolvedValue({
        id: 'otp-1',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.otp.delete.mockResolvedValue(undefined);
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        id: 'user-1',
        role: Role.PILGRIM,
        phone: '+224620000000',
        isActive: true,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.verifyOtp(
        '+224620000000',
        '123456',
        'Amadou Diallo',
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.PILGRIM, phone: '+224620000000' }),
      );
      expect(tokens.accessToken).toBe('signed-token');
      expect(tokens.refreshToken).toBe('signed-token');
    });
  });
});
