import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

@Injectable()
export class SavingsSchedulerService {
  private readonly logger = new Logger(SavingsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Exécution tous les jours à 10h00
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async processDueSavings() {
    this.logger.log('Lancement du job processDueSavings...');

    const now = new Date();
    const duePlans = await this.prisma.savingsPlan.findMany({
      where: {
        autoDeduct: true,
        nextDeductDate: { lte: now },
      },
      include: { booking: true },
    });

    this.logger.log(`Trouvé ${duePlans.length} plans d'épargne à traiter.`);

    for (const plan of duePlans) {
      if (!plan.deductAmount) continue;

      try {
        // Initier le paiement
        await this.paymentsService.initiate(plan.booking.pilgrimId, {
          bookingId: plan.bookingId,
          amount: plan.deductAmount,
          method: PaymentMethod.MOBILE_MONEY_ORANGE, // Par défaut ou issu du plan
        });

        // Envoyer le "rappel doux" par notification
        await this.notificationsService.send({
          recipientIds: [plan.booking.pilgrimId],
          type: NotificationType.PAYMENT,
          title: "Plan d'épargne Hajj/Omra",
          content: `C'est l'heure de votre cotisation de ${plan.deductAmount} GNF. Validez le paiement sur votre mobile pour avancer vers votre voyage !`,
          isCritical: false,
        });

        // Calculer la prochaine date
        const nextDate = new Date(plan.nextDeductDate || now);
        if (plan.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (plan.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else {
          // Désactiver si pas de fréquence connue
          plan.autoDeduct = false;
        }

        await this.prisma.savingsPlan.update({
          where: { id: plan.id },
          data: {
            nextDeductDate: plan.autoDeduct ? nextDate : null,
            autoDeduct: plan.autoDeduct,
          },
        });

        this.logger.log(`Plan ${plan.id} traité avec succès.`);
      } catch (error) {
        this.logger.error(
          `Erreur lors du traitement du plan ${plan.id}`,
          error,
        );
      }
    }

    this.logger.log('Job processDueSavings terminé.');
  }
}
