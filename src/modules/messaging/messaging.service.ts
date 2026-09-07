import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Conversation as PrismaConversation,
  Message as PrismaMessage,
  MessagingChannel as PrismaMessagingChannel,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingChannel } from '../../common/enums/messaging-channel.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { BookingShape, ConversationShape, MessageShape } from '../../types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

interface Participants {
  pilgrimId: string;
  otherId: string;
}

function toConversationShape(
  conversation: PrismaConversation,
): ConversationShape {
  return {
    id: conversation.id,
    bookingId: conversation.bookingId,
    channel: conversation.channel as unknown as MessagingChannel,
  };
}

function toMessageShape(message: PrismaMessage): MessageShape {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    clientSentAt: message.clientSentAt,
    readAt: message.readAt ?? undefined,
    createdAt: message.createdAt,
  };
}

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly agenciesService: AgenciesService,
    private readonly groupsService: GroupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOrCreateConversation(
    bookingId: string,
    channel: MessagingChannel,
    requesterId: string,
  ): Promise<ConversationShape> {
    const booking = await this.bookingsService.findByIdOrFail(bookingId);
    await this.assertParticipant(booking, channel, requesterId);

    const conversation = await this.prisma.conversation.upsert({
      where: {
        bookingId_channel: {
          bookingId,
          channel: channel as unknown as PrismaMessagingChannel,
        },
      },
      create: {
        bookingId,
        channel: channel as unknown as PrismaMessagingChannel,
      },
      update: {},
    });
    return toConversationShape(conversation);
  }

  // Verifie qu'un utilisateur peut acceder a une conversation, sans en
  // charger le contenu — utilise par la gateway websocket avant de le
  // laisser rejoindre la room Socket.IO correspondante (voir
  // MessagingGateway.handleJoin), pour ne jamais faire confiance a un
  // conversationId fourni par le client sans verification.
  async assertAccessToConversation(
    conversationId: string,
    userId: string,
  ): Promise<PrismaConversation> {
    const conversation = await this.findConversationOrFail(conversationId);
    const booking = await this.bookingsService.findByIdOrFail(
      conversation.bookingId,
    );
    await this.assertParticipant(
      booking,
      conversation.channel as unknown as MessagingChannel,
      userId,
    );
    return conversation;
  }

  async listMessages(
    conversationId: string,
    requesterId: string,
  ): Promise<MessageShape[]> {
    await this.assertAccessToConversation(conversationId, requesterId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(toMessageShape);
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ): Promise<MessageShape> {
    const conversation = await this.findConversationOrFail(conversationId);
    const booking = await this.bookingsService.findByIdOrFail(
      conversation.bookingId,
    );
    const { pilgrimId, otherId } = await this.assertParticipant(
      booking,
      conversation.channel as unknown as MessagingChannel,
      senderId,
    );

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: dto.content,
        clientSentAt: new Date(dto.clientSentAt),
      },
    });

    const recipientId = senderId === pilgrimId ? otherId : pilgrimId;
    await this.notificationsService.send({
      recipientIds: [recipientId],
      // Valeur d'enum reservee des les fondations (ADR 0009) pour ce cas
      // d'usage precisement, jamais cablee avant l'ADR 0014.
      type: NotificationType.GROUP_MESSAGE,
      title: 'Nouveau message',
      content: message.content,
      isCritical: false,
    });

    return toMessageShape(message);
  }

  private async findConversationOrFail(
    id: string,
  ): Promise<PrismaConversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }
    return conversation;
  }

  // Resout les deux participants legitimes d'un fil (pelerin + agence, ou
  // pelerin + guide) — voir ADR 0014 : deux fils strictement separes et
  // prives par reservation, jamais fusionnes.
  private async resolveParticipants(
    booking: BookingShape,
    channel: MessagingChannel,
  ): Promise<Participants> {
    if (channel === MessagingChannel.AGENCY) {
      const agency = await this.agenciesService.findByIdOrFail(
        booking.agencyId,
      );
      return { pilgrimId: booking.pilgrimId, otherId: agency.ownerId };
    }

    if (!booking.groupId) {
      throw new ConflictException(
        'Aucun guide assigné à cette réservation pour le moment',
      );
    }
    const group = await this.groupsService.findByIdOrFail(booking.groupId);
    if (!group.guideId) {
      throw new ConflictException(
        'Aucun guide assigné à cette réservation pour le moment',
      );
    }
    return { pilgrimId: booking.pilgrimId, otherId: group.guideId };
  }

  private async assertParticipant(
    booking: BookingShape,
    channel: MessagingChannel,
    userId: string,
  ): Promise<Participants> {
    const participants = await this.resolveParticipants(booking, channel);
    if (userId !== participants.pilgrimId && userId !== participants.otherId) {
      throw new ForbiddenException('Cette conversation ne vous appartient pas');
    }
    return participants;
  }
}
