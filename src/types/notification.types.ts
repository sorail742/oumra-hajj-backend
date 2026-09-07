import { NotificationType } from '../common/enums/notification-type.enum';

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
