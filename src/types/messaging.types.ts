import { MessagingChannel } from '../common/enums/messaging-channel.enum';

export interface ConversationShape {
  id: string;
  bookingId: string;
  channel: MessagingChannel;
}

export interface MessageShape {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  clientSentAt: Date;
  readAt?: Date;
  createdAt: Date;
}
