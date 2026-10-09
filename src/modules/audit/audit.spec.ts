import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AuditedOptions, champ } from './audited.decorator';

// Données explicitement factices (idée #85).
function contexte(params: Record<string, string>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        params,
        user: { sub: 'admin-1', role: Role.ADMIN },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  let record: jest.Mock;
  let options: AuditedOptions | undefined;
  let intercepteur: AuditInterceptor;

  beforeEach(() => {
    record = jest.fn();
    options = undefined;
    intercepteur = new AuditInterceptor(
      { get: () => options } as unknown as Reflector,
      { record } as unknown as AuditService,
    );
  });

  const appel = (reponse: unknown): CallHandler => ({
    handle: () => of(reponse),
  });

  it('trace une action réussie : auteur du jeton, entité de la route, références de la réponse', async () => {
    options = {
      action: 'payment.refund',
      entityType: 'payment',
      metadata: (r) => ({ refundedAmount: champ(r, 'refundedAmount') }),
    };
    const reponse = { id: 'paiement-1', refundedAmount: 500, note: { x: 1 } };

    await expect(
      firstValueFrom(
        intercepteur.intercept(contexte({ id: 'paiement-1' }), appel(reponse)),
      ),
    ).resolves.toBe(reponse);
    expect(record).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorRole: Role.ADMIN,
      action: 'payment.refund',
      entityType: 'payment',
      entityId: 'paiement-1',
      metadata: { refundedAmount: 500 },
    });
  });

  it("prend l'identifiant de la réponse pour une création", async () => {
    options = {
      action: 'emergency_number.create',
      entityType: 'emergency_number',
    };
    await firstValueFrom(
      intercepteur.intercept(contexte({}), appel({ id: 'numero-1' })),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'numero-1' }),
    );
  });

  it('ne trace ni une action échouée ni une route non marquée', async () => {
    options = { action: 'agency.approve', entityType: 'agency' };
    await expect(
      firstValueFrom(
        intercepteur.intercept(contexte({ id: 'a1' }), {
          handle: () => throwError(() => new Error('refus')),
        }),
      ),
    ).rejects.toThrow('refus');

    options = undefined;
    await firstValueFrom(intercepteur.intercept(contexte({}), appel({})));
    expect(record).not.toHaveBeenCalled();
  });
});

describe('AuditService', () => {
  let prisma: {
    auditLog: { create: jest.Mock; findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let service: AuditService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-20T12:00:00Z'));
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });
  afterEach(() => jest.useRealTimers());

  it("n'interrompt jamais l'action auditée si l'écriture échoue", async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('base indisponible'));
    const erreur = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await expect(
      service.record({ action: 'agency.approve', entityType: 'agency' }),
    ).resolves.toBeUndefined();
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });

  it('filtre par période (30 derniers jours par défaut) et critères', async () => {
    await service.list({ action: 'payment.refund' });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-09-20T12:00:00Z'),
            lt: new Date('2026-10-20T12:00:00Z'),
          },
          action: 'payment.refund',
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('rejette une période inversée ou de plus d’un an', async () => {
    await expect(
      service.list({ from: '2026-10-10', to: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.list({ from: '2024-01-01', to: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exporte en CSV avec le nom de l'auteur et des cellules neutralisées", async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'e1',
        actorId: 'admin-1',
        actorRole: 'admin',
        action: 'agency.reject',
        entityType: 'agency',
        entityId: '=1+1',
        metadata: null,
        createdAt: new Date('2026-10-19T08:00:00Z'),
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', fullName: '[DÉMO] Admin' },
    ]);

    const csv = await service.exportCsv({});
    const [, ligne] = csv.split('\r\n');
    expect(csv.startsWith('﻿"Date (UTC)";"Action"')).toBe(true);
    expect(ligne).toBe(
      `"2026-10-19T08:00:00.000Z";"agency.reject";"agency";"'=1+1";"[DÉMO] Admin";"admin";"admin-1";""`,
    );
  });
});
