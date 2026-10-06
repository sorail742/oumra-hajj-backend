import { Injectable } from '@nestjs/common';
import { MessagingChannel as PrismaMessagingChannel } from '@prisma/client';
import { MessagingChannel } from '../../common/enums/messaging-channel.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxConversationShape } from '../../types';
import { MessagingService } from './messaging.service';

// Boîte de réception et accusés de lecture (ticket web #67). Mêmes
// participants que `MessagingService.assertParticipant` (ADR 0014) : le
// pèlerin de la réservation, le propriétaire de l'agence pour le fil
// agence, le guide actuel du groupe pour le fil guide.
@Injectable()
export class MessagingInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  async listInbox(userId: string): Promise<InboxConversationShape[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        messages: { some: {} },
        OR: [
          { booking: { pilgrimId: userId } },
          {
            channel: PrismaMessagingChannel.agency,
            booking: { agency: { ownerId: userId } },
          },
          {
            channel: PrismaMessagingChannel.guide,
            booking: { group: { guideId: userId } },
          },
        ],
      },
      include: {
        booking: {
          select: {
            pilgrimId: true,
            pilgrim: { select: { fullName: true } },
            agency: { select: { legalName: true } },
            group: { select: { guide: { select: { fullName: true } } } },
            package: { select: { title: true } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            messages: { where: { readAt: null, senderId: { not: userId } } },
          },
        },
      },
    });

    return conversations
      .flatMap((conversation): InboxConversationShape[] => {
        const dernier = conversation.messages[0];
        if (!dernier) {
          return [];
        }
        const { booking } = conversation;
        const channel = conversation.channel as unknown as MessagingChannel;
        let counterpartName = booking.pilgrim.fullName;
        if (booking.pilgrimId === userId) {
          counterpartName =
            channel === MessagingChannel.AGENCY
              ? booking.agency.legalName
              : (booking.group?.guide?.fullName ?? '');
        }
        return [
          {
            id: conversation.id,
            bookingId: conversation.bookingId,
            channel,
            counterpartName,
            packageTitle: booking.package.title,
            lastMessage: {
              content: dernier.content,
              senderId: dernier.senderId,
              createdAt: dernier.createdAt,
            },
            unreadCount: conversation._count.messages,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
      );
  }

  // Marque lus les messages reçus de l'interlocuteur ; jamais ceux envoyés
  // par le demandeur lui-même.
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messagingService.assertAccessToConversation(
      conversationId,
      userId,
    );
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
