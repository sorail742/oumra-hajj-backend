import { NotificationType } from '../modules/notifications/schemas/notification.schema';

export interface NotificationShape {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  content: string;
  isCritical: boolean;
  readAt?: Date;
  createdAt: Date;
}
