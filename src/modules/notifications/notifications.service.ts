import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Notification as PrismaNotification,
  NotificationType as PrismaNotificationType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { NotificationShape } from '../../types/notification.types';
import { UsersService } from '../users/users.service';
import { PushSender, PUSH_SENDER } from './senders/push-sender.interface';
import { SmsSender, SMS_SENDER } from './senders/sms-sender.interface';

export interface SendNotificationInput {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  content: string;
  isCritical?: boolean;
}

function toNotificationShape(
  notification: PrismaNotification,
): NotificationShape {
  return {
    id: notification.id,
    recipientId: notification.recipientId,
    type: notification.type as unknown as NotificationType,
    title: notification.title,
    content: notification.content,
    isCritical: notification.isCritical,
    readAt: notification.readAt ?? undefined,
    createdAt: notification.createdAt,
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  async send(input: SendNotificationInput): Promise<NotificationShape[]> {
    const notifications = await this.prisma.notification.createManyAndReturn({
      data: input.recipientIds.map((recipientId) => ({
        recipientId,
        type: input.type as unknown as PrismaNotificationType,
        title: input.title,
        content: input.content,
        isCritical: input.isCritical ?? false,
      })),
    });

    // Envoi best-effort, sans bloquer la réponse API (voir ADR 0009 : le
    // module notifications ne doit pas ralentir les requêtes appelantes). Un
    // vrai mécanisme de file d'attente devra faire l'objet d'un ADR dédié
    // avant la mise en production.
    void Promise.all(
      input.recipientIds.map((recipientId) =>
        this.dispatch(recipientId, input),
      ),
    );

    return notifications.map(toNotificationShape);
  }

  private async dispatch(
    recipientId: string,
    input: SendNotificationInput,
  ): Promise<void> {
    const { delivered } = await this.pushSender.send(
      recipientId,
      input.title,
      input.content,
    );
    if (!delivered && input.isCritical) {
      const user = await this.usersService.findById(recipientId);
      if (user?.phone) {
        await this.smsSender.send(
          user.phone,
          `${input.title} — ${input.content}`,
        );
      }
    }
  }

  // Envoi SMS direct (hors collection Notification), utilisé pour les
  // contacts d'urgence qui ne sont pas des utilisateurs de la plateforme
  // (ex. bouton SOS — voir cahier des charges §3.1).
  sendRawSms(phone: string, content: string): Promise<void> {
    return this.smsSender.send(phone, content);
  }

  async listForUser(
    userId: string,
    unreadOnly = false,
  ): Promise<NotificationShape[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(unreadOnly && { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map(toNotificationShape);
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationShape> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification introuvable');
    }

    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    });
    return toNotificationShape(updated);
  }
}
