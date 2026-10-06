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

// Entrée de la boîte de réception (ticket web #67) : un fil où au moins un
// message a été échangé, vu par l'un de ses deux participants.
export interface InboxConversationShape {
  id: string;
  bookingId: string;
  channel: MessagingChannel;
  // Interlocuteur : agence ou guide pour le pèlerin, pèlerin sinon.
  counterpartName: string;
  packageTitle: string;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: Date;
  };
  // Messages de l'interlocuteur pas encore marqués lus.
  unreadCount: number;
}
