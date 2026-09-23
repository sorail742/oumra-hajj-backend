import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

@Injectable()
export class ChecklistSchedulerService {
  private readonly logger = new Logger(ChecklistSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Exécution tous les jours à 09h00
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async remindChecklistItems() {
    this.logger.log('Recherche des éléments de checklist à rappeler...');
    
    const now = new Date();
    
    const items = await this.prisma.checklistItem.findMany({
      where: {
        isCompleted: false,
        reminderSent: false,
        reminderDate: { lte: now },
      },
      include: { booking: true },
    });

    for (const item of items) {
      try {
        await this.notificationsService.send({
          recipientIds: [item.booking.pilgrimId],
          type: NotificationType.DOCUMENT, // on utilise une notif existante, à affiner
          title: 'Préparation : ' + item.category,
          content: `N'oubliez pas : ${item.title}. Cochez-le dans votre espace dès que c'est fait !`,
          isCritical: false,
        });

        await this.prisma.checklistItem.update({
          where: { id: item.id },
          data: { reminderSent: true },
        });

        this.logger.log(`Rappel envoyé pour l'item ${item.id}`);
      } catch (e) {
        this.logger.error(`Erreur lors de l'envoi du rappel ${item.id}`, e);
      }
    }
  }
}

