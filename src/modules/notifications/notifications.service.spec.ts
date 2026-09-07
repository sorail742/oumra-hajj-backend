import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';
import { PUSH_SENDER } from './senders/push-sender.interface';
import { SMS_SENDER } from './senders/sms-sender.interface';

// dispatch() est déclenché en fire-and-forget (void Promise.all) dans send(),
// voir ADR 0009 — on laisse le temps aux micro-tâches de se dérouler avant
// de vérifier les effets (envoi push/SMS).
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      createManyAndReturn: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let usersService: { findById: jest.Mock };
  let pushSender: { send: jest.Mock };
  let smsSender: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: {
        createManyAndReturn: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    usersService = { findById: jest.fn() };
    pushSender = { send: jest.fn().mockResolvedValue({ delivered: true }) };
    smsSender = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: PUSH_SENDER, useValue: pushSender },
        { provide: SMS_SENDER, useValue: smsSender },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('send', () => {
    it('crée une notification par destinataire avec isCritical par défaut à false', async () => {
      prisma.notification.createManyAndReturn.mockResolvedValue([
        {
          id: 'n1',
          recipientId: 'user-1',
          type: 'booking_status',
          title: 'Titre',
          content: 'Contenu',
          isCritical: false,
          readAt: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const notifications = await service.send({
        recipientIds: ['user-1', 'user-2'],
        type: NotificationType.BOOKING_STATUS,
        title: 'Titre',
        content: 'Contenu',
      });

      expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [
          {
            recipientId: 'user-1',
            type: NotificationType.BOOKING_STATUS,
            title: 'Titre',
            content: 'Contenu',
            isCritical: false,
          },
          {
            recipientId: 'user-2',
            type: NotificationType.BOOKING_STATUS,
            title: 'Titre',
            content: 'Contenu',
            isCritical: false,
          },
        ],
      });
      expect(notifications).toHaveLength(1);
    });

    it("n'envoie pas de SMS de secours si le push est délivré", async () => {
      prisma.notification.createManyAndReturn.mockResolvedValue([]);
      pushSender.send.mockResolvedValue({ delivered: true });

      await service.send({
        recipientIds: ['user-1'],
        type: NotificationType.SOS,
        title: 'Alerte',
        content: 'Contenu',
        isCritical: true,
      });
      await flushMicrotasks();

      expect(smsSender.send).not.toHaveBeenCalled();
    });

    it('bascule en SMS si le push échoue pour une alerte critique', async () => {
      prisma.notification.createManyAndReturn.mockResolvedValue([]);
      pushSender.send.mockResolvedValue({ delivered: false });
      usersService.findById.mockResolvedValue({ phone: '+224600000000' });

      await service.send({
        recipientIds: ['user-1'],
        type: NotificationType.SOS,
        title: 'Alerte',
        content: 'Contenu',
        isCritical: true,
      });
      await flushMicrotasks();

      expect(smsSender.send).toHaveBeenCalledWith(
        '+224600000000',
        'Alerte — Contenu',
      );
    });

    it("ne bascule pas en SMS si l'alerte n'est pas critique", async () => {
      prisma.notification.createManyAndReturn.mockResolvedValue([]);
      pushSender.send.mockResolvedValue({ delivered: false });

      await service.send({
        recipientIds: ['user-1'],
        type: NotificationType.OTHER,
        title: 'Titre',
        content: 'Contenu',
      });
      await flushMicrotasks();

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(smsSender.send).not.toHaveBeenCalled();
    });

    it("n'envoie pas de SMS si le destinataire critique n'a pas de téléphone enregistré", async () => {
      prisma.notification.createManyAndReturn.mockResolvedValue([]);
      pushSender.send.mockResolvedValue({ delivered: false });
      usersService.findById.mockResolvedValue({ phone: undefined });

      await service.send({
        recipientIds: ['user-1'],
        type: NotificationType.SOS,
        title: 'Alerte',
        content: 'Contenu',
        isCritical: true,
      });
      await flushMicrotasks();

      expect(smsSender.send).not.toHaveBeenCalled();
    });
  });

  describe('sendRawSms', () => {
    it('délègue directement au sender SMS', async () => {
      await service.sendRawSms('+224600000001', 'Contact urgence');

      expect(smsSender.send).toHaveBeenCalledWith(
        '+224600000001',
        'Contact urgence',
      );
    });
  });

  describe('listForUser', () => {
    it('filtre uniquement par destinataire par défaut', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.listForUser('user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('ajoute le filtre readAt quand unreadOnly est demandé', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.listForUser('user-1', true);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-1', readAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('markRead', () => {
    it('marque la notification comme lue', async () => {
      prisma.notification.findFirst.mockResolvedValue({
        id: 'n1',
        recipientId: 'user-1',
      });
      prisma.notification.update.mockResolvedValue({
        id: 'n1',
        recipientId: 'user-1',
        type: 'booking_status',
        title: 'Titre',
        content: 'Contenu',
        isCritical: false,
        readAt: new Date('2026-09-06'),
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.markRead('user-1', 'n1');

      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'n1', recipientId: 'user-1' },
      });
      expect(result.readAt).toBeInstanceOf(Date);
    });

    it("lève NotFoundException si la notification n'existe pas ou n'appartient pas à l'utilisateur", async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markRead('user-1', 'unknown'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });
});
