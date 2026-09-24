export interface CommunityMessageShape {
  id: string;
  groupId: string;
  senderId: string;
  senderName?: string;
  content: string;
  clientSentAt: Date;
  createdAt: Date;
}
