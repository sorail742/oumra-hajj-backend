import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PushSender, PUSH_SENDER } from './senders/push-sender.interface';
import { SmsSender, SMS_SENDER } from './senders/sms-sender.interface';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

export interface SendNotificationInput {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  content: string;
  isCritical?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly usersService: UsersService,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  async send(input: SendNotificationInput): Promise<NotificationDocument[]> {
    const docs = await this.notificationModel.insertMany(
      input.recipientIds.map((recipientId) => ({
        recipient: recipientId,
        type: input.type,
        title: input.title,
        content: input.content,
        isCritical: input.isCritical ?? false,
      })),
    );

    // Envoi best-effort, sans bloquer la réponse API (voir ADR 0009 : le
    // module notifications ne doit pas ralentir les requêtes appelantes). Un
    // vrai mécanisme de file d'attente devra faire l'objet d'un ADR dédié
    // avant la mise en production.
    void Promise.all(
      input.recipientIds.map((recipientId) =>
        this.dispatch(recipientId, input),
      ),
    );

    return docs;
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

  listForUser(
    userId: string,
    unreadOnly = false,
  ): Promise<NotificationDocument[]> {
    const filter: Record<string, unknown> = {
      recipient: userId,
    };
    if (unreadOnly) {
      filter.readAt = { $exists: false };
    }
    return this.notificationModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { readAt: new Date() },
        { new: true },
      )
      .exec();
    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }
    return notification;
  }
}
