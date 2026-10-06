import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingInboxService } from './messaging-inbox.service';
import { MessagingService } from './messaging.service';

// Données explicitement factices.
const PELERIN = 'pelerin-1';
const AGENCE = 'proprietaire-agence-1';

function fil(
  id: string,
  channel: 'agency' | 'guide',
  dernier: Date | null,
  nonLus = 0,
) {
  return {
    id,
    bookingId: `reservation-${id}`,
    channel,
    booking: {
      pilgrimId: PELERIN,
      pilgrim: { fullName: 'Pèlerin Fictif' },
      agency: { legalName: 'Agence Fictive' },
      group: { guide: { fullName: 'Guide Fictif' } },
      package: { title: 'Forfait fictif' },
    },
    messages: dernier
      ? [{ content: 'Bonjour', senderId: PELERIN, createdAt: dernier }]
      : [],
    _count: { messages: nonLus },
  };
}

describe('MessagingInboxService', () => {
  let prisma: {
    conversation: { findMany: jest.Mock };
    message: { updateMany: jest.Mock };
  };
  let messagingService: { assertAccessToConversation: jest.Mock };
  let service: MessagingInboxService;

  beforeEach(() => {
    prisma = {
      conversation: { findMany: jest.fn() },
      message: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    messagingService = { assertAccessToConversation: jest.fn() };
    service = new MessagingInboxService(
      prisma as unknown as PrismaService,
      messagingService as unknown as MessagingService,
    );
  });

  it("nomme l'interlocuteur selon le point de vue et trie par activité", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      fil('ancien', 'agency', new Date('2026-10-01')),
      fil('recent', 'guide', new Date('2026-10-05'), 2),
    ]);

    const pourPelerin = await service.listInbox(PELERIN);
    expect(pourPelerin.map((c) => [c.id, c.counterpartName])).toEqual([
      ['recent', 'Guide Fictif'],
      ['ancien', 'Agence Fictive'],
    ]);
    expect(pourPelerin[0]?.unreadCount).toBe(2);

    const pourAgence = await service.listInbox(AGENCE);
    expect(pourAgence[1]?.counterpartName).toBe('Pèlerin Fictif');
  });

  it('ignore un fil sans message', async () => {
    prisma.conversation.findMany.mockResolvedValue([
      fil('vide', 'agency', null),
    ]);
    await expect(service.listInbox(PELERIN)).resolves.toEqual([]);
  });

  it("ne marque lus que les messages de l'interlocuteur", async () => {
    await service.markAsRead('fil-1', AGENCE);

    expect(messagingService.assertAccessToConversation).toHaveBeenCalledWith(
      'fil-1',
      AGENCE,
    );
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'fil-1',
        senderId: { not: AGENCE },
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('refuse un non-participant sans rien modifier', async () => {
    messagingService.assertAccessToConversation.mockRejectedValue(
      new ForbiddenException(),
    );
    await expect(service.markAsRead('fil-1', 'inconnu')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });
});
