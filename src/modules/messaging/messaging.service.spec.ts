import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingChannel } from '../../common/enums/messaging-channel.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let prisma: {
    conversation: { upsert: jest.Mock; findUnique: jest.Mock };
    message: { create: jest.Mock; findMany: jest.Mock };
  };
  let bookingsService: { findByIdOrFail: jest.Mock };
  let agenciesService: { findByIdOrFail: jest.Mock };
  let groupsService: { findByIdOrFail: jest.Mock };
  let notificationsService: { send: jest.Mock };

  const pilgrimId = 'pilgrim-1';
  const agencyOwnerId = 'agency-owner-1';
  const guideId = 'guide-1';
  const strangerId = 'stranger-1';
  const bookingId = 'booking-1';
  const agencyId = 'agency-1';
  const groupId = 'group-1';
  const conversationId = 'conversation-1';

  const buildBooking = (overrides: Partial<{ groupId?: string }> = {}) => ({
    id: bookingId,
    pilgrimId,
    packageId: 'package-1',
    agencyId,
    groupId,
    status: 'confirmed',
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      conversation: { upsert: jest.fn(), findUnique: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn() },
    };
    bookingsService = { findByIdOrFail: jest.fn() };
    agenciesService = { findByIdOrFail: jest.fn() };
    groupsService = { findByIdOrFail: jest.fn() };
    notificationsService = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: GroupsService, useValue: groupsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(MessagingService);

    bookingsService.findByIdOrFail.mockResolvedValue(buildBooking());
    agenciesService.findByIdOrFail.mockResolvedValue({
      id: agencyId,
      ownerId: agencyOwnerId,
    });
    groupsService.findByIdOrFail.mockResolvedValue({
      id: groupId,
      guideId,
    });
  });

  describe('getOrCreateConversation', () => {
    it('crée (ou récupère) le fil agence pour le pèlerin de la réservation', async () => {
      prisma.conversation.upsert.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'agency',
      });

      const conversation = await service.getOrCreateConversation(
        bookingId,
        MessagingChannel.AGENCY,
        pilgrimId,
      );

      expect(prisma.conversation.upsert).toHaveBeenCalledWith({
        where: { bookingId_channel: { bookingId, channel: 'agency' } },
        create: { bookingId, channel: 'agency' },
        update: {},
      });
      expect(conversation.channel).toBe(MessagingChannel.AGENCY);
    });

    it("autorise le propriétaire de l'agence sur le fil agence", async () => {
      prisma.conversation.upsert.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'agency',
      });

      await expect(
        service.getOrCreateConversation(
          bookingId,
          MessagingChannel.AGENCY,
          agencyOwnerId,
        ),
      ).resolves.toBeDefined();
    });

    it('autorise le guide assigné sur le fil guide', async () => {
      prisma.conversation.upsert.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'guide',
      });

      await expect(
        service.getOrCreateConversation(
          bookingId,
          MessagingChannel.GUIDE,
          guideId,
        ),
      ).resolves.toBeDefined();
    });

    it("rejette un utilisateur qui n'est ni le pèlerin ni l'autre participant", async () => {
      await expect(
        service.getOrCreateConversation(
          bookingId,
          MessagingChannel.AGENCY,
          strangerId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });

    it("rejette le fil guide si aucun groupe n'est assigné à la réservation", async () => {
      bookingsService.findByIdOrFail.mockResolvedValue(
        buildBooking({ groupId: undefined }),
      );

      await expect(
        service.getOrCreateConversation(
          bookingId,
          MessagingChannel.GUIDE,
          pilgrimId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejette le fil guide si le groupe n'a pas encore de guide assigné", async () => {
      groupsService.findByIdOrFail.mockResolvedValue({
        id: groupId,
        guideId: undefined,
      });

      await expect(
        service.getOrCreateConversation(
          bookingId,
          MessagingChannel.GUIDE,
          pilgrimId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listMessages', () => {
    it('liste les messages triés par date de création croissante', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'agency',
      });
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'message-1',
          conversationId,
          senderId: pilgrimId,
          content: 'Bonjour',
          clientSentAt: new Date('2026-01-01T10:00:00Z'),
          readAt: null,
          createdAt: new Date('2026-01-01T10:00:01Z'),
        },
      ]);

      const messages = await service.listMessages(conversationId, pilgrimId);

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
      expect(messages).toHaveLength(1);
    });

    it('rejette si la conversation est introuvable', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.listMessages(conversationId, pilgrimId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejette un utilisateur hors de la conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'agency',
      });

      await expect(
        service.listMessages(conversationId, strangerId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'agency',
      });
      prisma.message.create.mockResolvedValue({
        id: 'message-1',
        conversationId,
        senderId: pilgrimId,
        content: 'Bonjour',
        clientSentAt: new Date('2026-01-01T10:00:00Z'),
        readAt: null,
        createdAt: new Date('2026-01-01T10:00:01Z'),
      });
    });

    it('persiste le message puis notifie le destinataire (agence)', async () => {
      const message = await service.sendMessage(conversationId, pilgrimId, {
        content: 'Bonjour',
        clientSentAt: '2026-01-01T10:00:00Z',
      });

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          senderId: pilgrimId,
          content: 'Bonjour',
          clientSentAt: new Date('2026-01-01T10:00:00Z'),
        },
      });
      expect(notificationsService.send).toHaveBeenCalledWith({
        recipientIds: [agencyOwnerId],
        type: NotificationType.GROUP_MESSAGE,
        title: 'Nouveau message',
        content: 'Bonjour',
        isCritical: false,
      });
      expect(message.id).toBe('message-1');
    });

    it("notifie le pèlerin quand c'est l'agence qui écrit", async () => {
      await service.sendMessage(conversationId, agencyOwnerId, {
        content: 'Bonjour',
        clientSentAt: '2026-01-01T10:00:00Z',
      });

      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ recipientIds: [pilgrimId] }),
      );
    });

    it('rejette un expéditeur hors de la conversation', async () => {
      await expect(
        service.sendMessage(conversationId, strangerId, {
          content: 'Bonjour',
          clientSentAt: '2026-01-01T10:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('assertAccessToConversation', () => {
    it("retourne la conversation si l'utilisateur y participe", async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        bookingId,
        channel: 'guide',
      });

      await expect(
        service.assertAccessToConversation(conversationId, guideId),
      ).resolves.toEqual(expect.objectContaining({ id: conversationId }));
    });
  });
});
