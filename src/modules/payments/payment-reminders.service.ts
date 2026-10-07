import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BookingStatus as PrismaBookingStatus,
  PaymentStatus as PrismaPaymentStatus,
} from '@prisma/client';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BALANCE_DUE_DAYS_BEFORE_DEPARTURE,
  BALANCE_REMINDER_OFFSETS_DAYS,
  balanceDueDate,
  daysBetween,
} from './payment-schedule';

const ACTIVE_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
] as unknown as PrismaBookingStatus[];

const formatGnf = (amount: number) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} GNF`;

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

/**
 * Relances de paiement préventives (backlog #67) : « avant l'échéance, pas
 * seulement après un retard déjà constaté ». Chaque jour, un pèlerin dont
 * la réservation active a encore un solde reçoit un rappel 14 jours, 7
 * jours puis la veille de la date limite du solde (départ − 30 jours).
 *
 * Le rappel n'initie aucun paiement et ne recalcule rien côté client : il
 * informe du solde calculé ici à partir des seuls paiements confirmés par
 * callback (ADR 0006). Les journaux ne contiennent que des compteurs.
 */
@Injectable()
export class PaymentRemindersService {
  private readonly logger = new Logger(PaymentRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 8 * * *')
  async sendPreventiveReminders(now: Date = new Date()): Promise<number> {
    const maxOffset = Math.max(...BALANCE_REMINDER_OFFSETS_DAYS);
    const windowStart = new Date(now);
    windowStart.setUTCDate(
      windowStart.getUTCDate() + BALANCE_DUE_DAYS_BEFORE_DEPARTURE,
    );
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + maxOffset + 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        package: { startDate: { gte: windowStart, lt: windowEnd } },
      },
      include: {
        package: true,
        payments: {
          where: {
            status: PaymentStatus.SUCCEEDED as unknown as PrismaPaymentStatus,
          },
        },
      },
    });

    let sent = 0;
    for (const booking of bookings) {
      const dueDate = balanceDueDate(booking.package.startDate);
      const daysLeft = daysBetween(now, dueDate);
      if (
        !BALANCE_REMINDER_OFFSETS_DAYS.includes(
          daysLeft as (typeof BALANCE_REMINDER_OFFSETS_DAYS)[number],
        )
      ) {
        continue;
      }
      const collected = booking.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = booking.package.price - collected;
      if (balance <= 0) continue;

      try {
        await this.notificationsService.send({
          recipientIds: [booking.pilgrimId],
          type: NotificationType.PAYMENT,
          title: `Solde à régler avant le ${formatDate(dueDate)}`,
          content: `Il reste ${formatGnf(balance)} à régler pour « ${booking.package.title} » avant le ${formatDate(dueDate)}. Vous pouvez payer une tranche depuis votre dossier de réservation.`,
          isCritical: false,
        });
        sent += 1;
      } catch (error) {
        this.logger.error('Échec d’une relance de paiement préventive', error);
      }
    }

    this.logger.log(
      `Relances préventives : ${sent} envoyée(s) sur ${bookings.length} réservation(s) examinée(s).`,
    );
    return sent;
  }
}
