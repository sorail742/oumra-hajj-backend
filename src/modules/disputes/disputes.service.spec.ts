import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { DisputeStatus } from '../../types/dispute.types';
import { NotificationsService } from '../notifications/notifications.service';
import { DisputePurgeService } from './dispute-purge.service';
import { DisputesService } from './disputes.service';

// Données explicitement factices (idée #62).
const ID = '22222222-2222-4222-8222-222222222222';

function litige(surcharge: Record<string, unknown> = {}) {
  return {
    id: ID,
    bookingId: 'resa-1',
    pilgrimId: 'pelerin-1',
    agencyId: 'agence-1',
    category: 'accommodation',
    subject: '[DÉMO] Chambre différente du contrat',
    status: 'open',
    decision: null,
    escalatedAt: null,
    closedAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    booking: { package: { title: '[DÉMO] Oumra fictive' } },
    agency: { legalName: '[DÉMO] Agence fictive', ownerId: 'proprio-1' },
    pilgrim: { fullName: '[DÉMO] Pèlerin' },
    messages: [
      {
        id: 'm1',
        authorRole: 'pilgrim',
        content: '[DÉMO] Message confidentiel',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        author: { fullName: '[DÉMO] Pèlerin' },
      },
    ],
    ...surcharge,
  };
}

describe('DisputesService', () => {
  let prisma: {
    dispute: Record<string, jest.Mock>;
    booking: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
  };
  let send: jest.Mock;
  let service: DisputesService;
  let journal: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-03T00:00:00Z'));
    prisma = {
      dispute: {
        findUnique: jest.fn().mockResolvedValue(litige()),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(litige()),
        update: jest.fn(),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'resa-1',
          pilgrimId: 'pelerin-1',
          agencyId: 'agence-1',
          agency: { ownerId: 'proprio-1' },
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
    };
    send = jest.fn();
    service = new DisputesService(
      prisma as unknown as PrismaService,
      { send } as unknown as NotificationsService,
    );
    journal = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => {
    jest.useRealTimers();
    journal.mockRestore();
  });

  describe('ouverture', () => {
    it("ouvre le litige avec l'exposé du pèlerin et prévient l'agence, sans le contenu", async () => {
      await service.create('pelerin-1', {
        bookingId: 'resa-1',
        category: 'accommodation',
        subject: '[DÉMO] Chambre différente du contrat',
        message: '[DÉMO] Message confidentiel',
      });

      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agencyId: 'agence-1',
            messages: {
              create: expect.objectContaining({ authorRole: 'pilgrim' }),
            },
          }),
        }),
      );
      const notification = send.mock.calls[0]?.[0];
      expect(notification.recipientIds).toEqual(['proprio-1']);
      expect(notification.content).not.toContain('confidentiel');
    });

    it("refuse la réservation d'un autre pèlerin et un second litige en cours", async () => {
      await expect(
        service.create('pelerin-2', {
          bookingId: 'resa-1',
          category: 'other',
          subject: '[DÉMO] Sujet',
          message: '[DÉMO] Exposé factice',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.dispute.findFirst.mockResolvedValue(litige());
      await expect(
        service.create('pelerin-1', {
          bookingId: 'resa-1',
          category: 'other',
          subject: '[DÉMO] Sujet',
          message: '[DÉMO] Exposé factice',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('accès', () => {
    it("n'ouvre le litige qu'au pèlerin, à l'agence concernée, et à l'admin après escalade", async () => {
      await expect(
        service.findOne('pelerin-1', Role.PILGRIM, ID),
      ).resolves.toBeDefined();
      await expect(
        service.findOne('proprio-1', Role.AGENCY, ID),
      ).resolves.toBeDefined();
      await expect(
        service.findOne('pelerin-2', Role.PILGRIM, ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.findOne('proprio-2', Role.AGENCY, ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.findOne('admin-1', Role.ADMIN, ID),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.dispute.findUnique.mockResolvedValue(
        litige({ status: 'escalated' }),
      );
      await expect(
        service.findOne('admin-1', Role.ADMIN, ID),
      ).resolves.toBeDefined();
    });

    it('journalise chaque consultation sans son contenu', async () => {
      await service.findOne('proprio-1', Role.AGENCY, ID);
      const message = String(journal.mock.calls[0]?.[0]);
      expect(message).toContain(ID);
      expect(message).toContain('proprio-1');
      expect(message).not.toContain('confidentiel');
      expect(message).not.toContain('Chambre');
    });

    it("limite la liste de l'admin aux litiges escaladés ou tranchés", async () => {
      await service.list('admin-1', Role.ADMIN, {});
      expect(prisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ status: { in: ['escalated', 'closed'] } }, {}],
          },
        }),
      );
    });
  });

  describe('dialogue', () => {
    it("passe la main au pèlerin quand l'agence répond, et inversement", async () => {
      await service.addMessage('proprio-1', Role.AGENCY, ID, '[DÉMO] Réponse');
      expect(prisma.dispute.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'agency_responded' }),
        }),
      );
      expect(send.mock.calls[0]?.[0].recipientIds).toEqual(['pelerin-1']);

      prisma.dispute.findUnique.mockResolvedValue(
        litige({ status: 'agency_responded' }),
      );
      await service.addMessage('pelerin-1', Role.PILGRIM, ID, '[DÉMO] Relance');
      expect(prisma.dispute.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'open' }),
        }),
      );
    });

    it('refuse un message sur un litige clos', async () => {
      prisma.dispute.findUnique.mockResolvedValue(
        litige({ status: 'resolved' }),
      );
      await expect(
        service.addMessage('pelerin-1', Role.PILGRIM, ID, '[DÉMO] Message'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('escalade', () => {
    it("est refusée tant que l'agence a encore le temps de répondre", async () => {
      await expect(service.escalate('pelerin-1', ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.dispute.update).not.toHaveBeenCalled();
    });

    it("est permise après une réponse de l'agence et prévient agence et admins", async () => {
      prisma.dispute.findUnique.mockResolvedValue(
        litige({ status: 'agency_responded' }),
      );
      await service.escalate('pelerin-1', ID);

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { status: 'escalated', escalatedAt: expect.any(Date) },
      });
      expect(send.mock.calls[0]?.[0].recipientIds).toEqual([
        'proprio-1',
        'admin-1',
      ]);
    });

    it("est permise sans réponse passé le délai laissé à l'agence", async () => {
      jest.setSystemTime(new Date('2026-10-08T00:00:00Z'));
      await service.escalate('pelerin-1', ID);
      expect(prisma.dispute.update).toHaveBeenCalled();
    });
  });

  describe('arbitrage', () => {
    it("clôt un litige escaladé par la décision de l'admin", async () => {
      prisma.dispute.findUnique.mockResolvedValue(
        litige({ status: 'escalated' }),
      );
      await service.decide('admin-1', ID, '[DÉMO] Décision factice motivée');

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: expect.objectContaining({
          status: 'closed',
          decidedById: 'admin-1',
          decision: '[DÉMO] Décision factice motivée',
        }),
      });
      expect(send.mock.calls[0]?.[0].recipientIds).toEqual([
        'pelerin-1',
        'proprio-1',
      ]);
    });

    it('le pèlerin peut clore à l’amiable', async () => {
      const resultat = await service.resolve('pelerin-1', ID);
      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { status: 'resolved', closedAt: expect.any(Date) },
      });
      expect(resultat.status).toBe(DisputeStatus.OPEN); // état relu (mock)
    });
  });
});

describe('DisputePurgeService', () => {
  it('supprime les litiges clos depuis plus de 24 mois', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const purge = new DisputePurgeService({
      dispute: { deleteMany },
    } as unknown as PrismaService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const count = await purge.purgeClosedDisputes(
      new Date('2026-10-08T00:00:00Z'),
    );

    expect(count).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['resolved', 'closed'] },
        closedAt: { lt: new Date('2024-10-08T00:00:00Z') },
      },
    });
  });
});
