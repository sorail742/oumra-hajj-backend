import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { choosePasswordResetMailer } from './password-reset-mailer';
import { hashResetToken, PasswordResetService } from './password-reset.service';

// Données explicitement factices (CLAUDE.md).
const AGENCE = {
  id: 'user-agence-fictive',
  email: 'agence@example.test',
  role: 'agency',
  isActive: true,
  passwordHash: 'empreinte-factice',
};
const JETON = 'a'.repeat(43);

function config(
  overrides: Partial<AppConfig> = {},
): ConfigService<AppConfig, true> {
  const values: Partial<AppConfig> = {
    env: 'production',
    emailjs: {
      serviceId: 'service_factice',
      templateId: 'template_otp_factice',
      publicKey: 'cle-publique-factice',
      privateKey: 'cle-privee-factice',
    },
    passwordReset: {
      ttlMinutes: 30,
      webAppUrl: 'https://web.example.test',
      emailjsTemplateId: 'template_reset_factice',
    },
    ...overrides,
  };
  return {
    get: (key: keyof AppConfig) => values[key],
  } as unknown as ConfigService<AppConfig, true>;
}

describe('PasswordResetService', () => {
  let prisma: {
    $transaction: jest.Mock;
    passwordResetToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    user: { update: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };
  let usersService: { findByEmailWithPassword: jest.Mock };
  let mailer: { available: boolean; send: jest.Mock };
  let service: PasswordResetService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
      passwordResetToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    usersService = { findByEmailWithPassword: jest.fn() };
    mailer = { available: true, send: jest.fn().mockResolvedValue(undefined) };
    service = new PasswordResetService(
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
      config(),
      mailer,
    );
  });

  describe('requestReset', () => {
    it("envoie un lien dont le jeton est dans le fragment et n'en stocke que l'empreinte", async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(AGENCE);

      await expect(service.requestReset(AGENCE.email)).resolves.toEqual({
        sent: true,
      });

      const [destinataire, lien, ttl] = mailer.send.mock.calls[0] as [
        string,
        string,
        number,
      ];
      expect(destinataire).toBe(AGENCE.email);
      expect(ttl).toBe(30);
      const url = new URL(lien);
      expect(url.origin + url.pathname).toBe(
        'https://web.example.test/reset-password',
      );
      expect(url.search).toBe('');
      const jeton = url.hash.replace('#token=', '');
      expect(jeton).toHaveLength(43);

      const { data } = prisma.passwordResetToken.create.mock.calls[0][0] as {
        data: { tokenHash: string; userId: string };
      };
      expect(data.userId).toBe(AGENCE.id);
      expect(data.tokenHash).toBe(hashResetToken(jeton));
      expect(data.tokenHash).not.toContain(jeton);
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: AGENCE.id },
      });
    });

    it.each([
      ['aucun compte', null],
      [
        'un pèlerin (pas de mot de passe)',
        { ...AGENCE, role: 'pilgrim', passwordHash: null },
      ],
      ['un compte suspendu', { ...AGENCE, isActive: false }],
    ])('répond pareil sans rien envoyer pour %s', async (_cas, user) => {
      usersService.findByEmailWithPassword.mockResolvedValue(user);

      await expect(service.requestReset(AGENCE.email)).resolves.toEqual({
        sent: true,
      });
      expect(mailer.send).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("ne révèle pas l'existence du compte si l'envoi échoue", async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(AGENCE);
      mailer.send.mockRejectedValue(new Error('EmailJS'));

      await expect(service.requestReset(AGENCE.email)).resolves.toEqual({
        sent: true,
      });
    });

    it('refuse (503) avant toute recherche quand le canal est indisponible', async () => {
      mailer.available = false;

      await expect(service.requestReset(AGENCE.email)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(usersService.findByEmailWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const enregistrement = {
      userId: AGENCE.id,
      expiresAt: new Date(Date.now() + 60_000),
      user: AGENCE,
    };

    it('change le mot de passe, consomme le jeton et ferme toutes les sessions', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(enregistrement);

      await service.resetPassword(JETON, 'nouveau-mot-de-passe-factice');

      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashResetToken(JETON) },
        include: { user: true },
      });
      const { data } = prisma.user.update.mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      await expect(
        bcrypt.compare('nouveau-mot-de-passe-factice', data.passwordHash),
      ).resolves.toBe(true);
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: AGENCE.id },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: AGENCE.id, revoked: false },
        data: { revoked: true },
      });
    });

    it.each([
      ['inconnu', null],
      ['expiré', { ...enregistrement, expiresAt: new Date(Date.now() - 1) }],
      [
        'd’un compte suspendu',
        { ...enregistrement, user: { ...AGENCE, isActive: false } },
      ],
    ])('refuse un jeton %s', async (_cas, record) => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(record);

      await expect(
        service.resetPassword(JETON, 'nouveau-mot-de-passe-factice'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe('choosePasswordResetMailer', () => {
  it('est disponible quand EmailJS, le gabarit et WEB_APP_URL sont renseignés', () => {
    expect(choosePasswordResetMailer(config()).available).toBe(true);
  });

  it('est indisponible en production sans WEB_APP_URL — jamais de lien journalisé', () => {
    const mailer = choosePasswordResetMailer(
      config({
        passwordReset: {
          ttlMinutes: 30,
          webAppUrl: '',
          emailjsTemplateId: 'template_reset_factice',
        },
      }),
    );
    expect(mailer.available).toBe(false);
  });

  it('journalise le lien seulement hors production', () => {
    const mailer = choosePasswordResetMailer(
      config({
        env: 'development',
        passwordReset: { ttlMinutes: 30, webAppUrl: '', emailjsTemplateId: '' },
      }),
    );
    expect(mailer.available).toBe(true);
  });
});

describe('envoi EmailJS du lien', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    global.fetch = fetchMock;
  });
  afterEach(() => fetchMock.mockReset());

  it('utilise le gabarit dédié et transmet le lien', async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    const mailer = choosePasswordResetMailer(config());

    await mailer.send(
      'agence@example.test',
      'https://web.example.test/reset-password#token=x',
      30,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      service_id: 'service_factice',
      template_id: 'template_reset_factice',
      accessToken: 'cle-privee-factice',
      template_params: {
        to_email: 'agence@example.test',
        reset_url: 'https://web.example.test/reset-password#token=x',
        expires_in_minutes: 30,
      },
    });
  });
});
