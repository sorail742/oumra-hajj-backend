import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Payment as PrismaPayment,
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
  SavingsPlan as PrismaSavingsPlan,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Role } from '../../common/enums/role.enum';
import {
  PaymentShape,
  RefundPreviewShape,
  SavingsPlanShape,
  TreasuryProjectionShape,
} from '../../types/payment.types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackagesService } from '../packages/packages.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { balanceDueDate } from './payment-schedule';
import { SetupSavingsPlanDto } from './dto/setup-savings-plan.dto';
import { RefundPolicyService } from './refund-policy.service';
import {
  PaymentProvider,
  PAYMENT_PROVIDER,
} from './providers/payment-provider.interface';

const DEFAULT_CURRENCY = 'GNF';

function toSavingsPlanShape(plan: PrismaSavingsPlan): SavingsPlanShape {
  return {
    id: plan.id,
    bookingId: plan.bookingId,
    targetAmount: plan.targetAmount,
    autoDeduct: plan.autoDeduct,
    deductAmount: plan.deductAmount ?? undefined,
    frequency: plan.frequency ?? undefined,
    nextDeductDate: plan.nextDeductDate ?? undefined,
  };
}

function toPaymentShape(payment: PrismaPayment): PaymentShape {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    amount: payment.amount,
    currency: payment.currency,
    installmentNumber: payment.installmentNumber,
    method: payment.method as unknown as PaymentMethod,
    status: payment.status as unknown as PaymentStatus,
    providerReference: payment.providerReference,
    receiptRef: payment.receiptRef ?? undefined,
    confirmedAt: payment.confirmedAt ?? undefined,
    refundedAmount: payment.refundedAmount ?? undefined,
    refundedAt: payment.refundedAt ?? undefined,
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly packagesService: PackagesService,
    private readonly agenciesService: AgenciesService,
    private readonly notificationsService: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly refundPolicyService: RefundPolicyService,
  ) {}

  /** Aperçu du remboursement avant de le demander — même règle que requestRefund. */
  async previewRefund(
    requesterId: string,
    requesterRole: Role,
    paymentId: string,
  ): Promise<RefundPreviewShape> {
    const payment = await this.findAuthorizedOrFail(
      requesterId,
      requesterRole,
      paymentId,
    );
    const contexte = await this.refundPolicyService.contextFor(
      payment.bookingId,
    );
    const remboursable = payment.status === PaymentStatus.SUCCEEDED;
    const eligibleRate = remboursable ? contexte.rate : 0;
    return {
      paymentId: payment.id,
      eligibleRate,
      refundableAmount: Math.round(payment.amount * eligibleRate * 100) / 100,
      currency: payment.currency,
      rule: remboursable ? contexte.rule : 'not_refundable',
      daysBeforeDeparture: contexte.daysBeforeDeparture,
      tiers: contexte.tiers,
    };
  }

  async initiate(
    pilgrimId: string,
    dto: InitiatePaymentDto,
  ): Promise<PaymentShape> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    const installmentNumber =
      (await this.prisma.payment.count({
        where: { bookingId: booking.id },
      })) + 1;

    const { providerReference } = await this.paymentProvider.initiate({
      bookingId: booking.id,
      amount: dto.amount,
      currency: DEFAULT_CURRENCY,
      method: dto.method,
    });

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: dto.amount,
        installmentNumber,
        method: dto.method as unknown as PrismaPaymentMethod,
        status: PaymentStatus.PENDING as unknown as PrismaPaymentStatus,
        providerReference,
      },
    });
    return toPaymentShape(payment);
  }

  async findByIdOrFail(id: string): Promise<PaymentShape> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }
    return toPaymentShape(payment);
  }

  async findForPilgrim(pilgrimId: string): Promise<PaymentShape[]> {
    const bookings = await this.bookingsService.findMine(pilgrimId);
    const bookingIds = bookings.map((b) => b.id);
    const payments = await this.prisma.payment.findMany({
      where: { bookingId: { in: bookingIds } },
    });
    return payments.map(toPaymentShape);
  }

  async findAuthorizedOrFail(
    requesterId: string,
    requesterRole: Role,
    paymentId: string,
  ): Promise<PaymentShape> {
    const payment = await this.findByIdOrFail(paymentId);
    const booking = await this.bookingsService.findByIdOrFail(
      payment.bookingId,
    );

    if (requesterRole === Role.ADMIN || booking.pilgrimId === requesterId) {
      return payment;
    }

    if (requesterRole === Role.AGENCY) {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (booking.agencyId === agency.id) {
        return payment;
      }
    }

    throw new ForbiddenException("Vous n'avez pas accès à ce paiement");
  }

  async findByBooking(bookingId: string): Promise<PaymentShape[]> {
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
    });
    return payments.map(toPaymentShape);
  }

  async findForAgency(ownerId: string): Promise<PaymentShape[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const bookings = await this.bookingsService.findByAgency(ownerId);
    const bookingIds = bookings
      .filter((b) => b.agencyId === agency.id)
      .map((b) => b.id);
    const payments = await this.prisma.payment.findMany({
      where: { bookingId: { in: bookingIds } },
    });
    return payments.map(toPaymentShape);
  }

  // Callback serveur-à-serveur du prestataire — voir ADR 0006.
  async handleWebhook(dto: PaymentWebhookDto): Promise<PaymentShape> {
    const existing = await this.prisma.payment.findUnique({
      where: { providerReference: dto.providerReference },
    });
    if (!existing) {
      throw new NotFoundException('Paiement introuvable pour cette référence');
    }

    const payment = await this.prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: dto.status as unknown as PrismaPaymentStatus,
        ...(dto.status === PaymentStatus.SUCCEEDED && {
          confirmedAt: new Date(),
          receiptRef: `RCPT-${existing.id}`,
        }),
      },
    });

    if (dto.status === PaymentStatus.SUCCEEDED) {
      await this.reconcileBookingPaymentStep(payment.bookingId);
    }

    return toPaymentShape(payment);
  }

  // Idée #58 (backlog "Cent Fonctionnalités") : remboursement selon le
  // barème de remboursement figé sur la réservation (RefundPolicyService),
  // jamais une négociation au cas par cas.
  async requestRefund(
    requesterId: string,
    requesterRole: Role,
    paymentId: string,
  ): Promise<PaymentShape> {
    const payment = await this.findAuthorizedOrFail(
      requesterId,
      requesterRole,
      paymentId,
    );
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new ConflictException(
        'Seul un paiement confirmé peut être remboursé',
      );
    }

    const booking = await this.bookingsService.findByIdOrFail(
      payment.bookingId,
    );
    const { rate: eligibleRate } = await this.refundPolicyService.contextFor(
      booking.id,
    );
    if (eligibleRate === 0) {
      throw new ConflictException(
        "Ce paiement n'est plus remboursable au statut actuel de la réservation",
      );
    }

    const refundedAmount =
      Math.round(payment.amount * eligibleRate * 100) / 100;
    await this.paymentProvider.refund(
      payment.providerReference,
      refundedAmount,
    );

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED as unknown as PrismaPaymentStatus,
        refundedAmount,
        refundedAt: new Date(),
      },
    });

    // Même pattern que les notifications d'étapes (idée #29) : le pèlerin
    // doit savoir combien lui revient réellement, pas juste "remboursé".
    await this.notificationsService.send({
      recipientIds: [booking.pilgrimId],
      type: NotificationType.PAYMENT,
      title: 'Remboursement traité',
      content:
        eligibleRate < 1
          ? `Remboursement partiel de ${refundedAmount} ${updated.currency} (${Math.round(eligibleRate * 100)}% du paiement, selon le barème de remboursement de votre réservation).`
          : `Remboursement intégral de ${refundedAmount} ${updated.currency}.`,
      isCritical: false,
    });

    return toPaymentShape(updated);
  }

  // Supervision des paiements — cahier des charges §3.4.
  async sumSucceededAmount(): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCEEDED as unknown as PrismaPaymentStatus,
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  private async reconcileBookingPaymentStep(bookingId: string): Promise<void> {
    const booking = await this.bookingsService.findByIdOrFail(bookingId);
    const pkg = await this.packagesService.findByIdOrFail(booking.packageId);
    const payments = await this.findByBooking(bookingId);
    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.SUCCEEDED)
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid >= pkg.price) {
      await this.bookingsService.markStepDone(
        bookingId,
        DossierStepKey.PAYMENT,
      );
    }
  }

  // --- Plan d'épargne (Ticket 1) ---

  // Lecture réservée au pèlerin titulaire de la réservation : sans ce
  // contrôle, n'importe quel pèlerin lisait le plan d'un autre par son id.
  async findSavingsPlanByBooking(
    pilgrimId: string,
    bookingId: string,
  ): Promise<SavingsPlanShape | null> {
    const booking = await this.bookingsService.findByIdOrFail(bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    const plan = await this.prisma.savingsPlan.findUnique({
      where: { bookingId },
    });
    if (!plan) return null;
    return toSavingsPlanShape(plan);
  }

  async setupSavingsPlan(
    pilgrimId: string,
    bookingId: string,
    dto: SetupSavingsPlanDto,
  ): Promise<SavingsPlanShape> {
    const booking = await this.bookingsService.findByIdOrFail(bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new ConflictException(
        "Plan d'épargne impossible sur une réservation annulée ou terminée",
      );
    }
    if (dto.autoDeduct && (!dto.deductAmount || !dto.frequency)) {
      throw new BadRequestException(
        'Montant et fréquence requis pour activer les cotisations automatiques',
      );
    }
    const pkg = await this.packagesService.findByIdOrFail(booking.packageId);

    let nextDate: Date | undefined;
    if (dto.autoDeduct && dto.frequency) {
      nextDate = new Date();
      if (dto.frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (dto.frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    }

    const plan = await this.prisma.savingsPlan.upsert({
      where: { bookingId },
      update: {
        autoDeduct: dto.autoDeduct,
        deductAmount: dto.deductAmount,
        frequency: dto.frequency,
        nextDeductDate: nextDate,
      },
      create: {
        bookingId,
        targetAmount: pkg.price,
        autoDeduct: dto.autoDeduct,
        deductAmount: dto.deductAmount,
        frequency: dto.frequency,
        nextDeductDate: nextDate,
      },
    });

    return toSavingsPlanShape(plan);
  }

  // Ticket #38 : Trésorerie prévisionnelle
  async getTreasuryProjection(
    ownerId: string,
  ): Promise<TreasuryProjectionShape> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);

    const bookings = await this.prisma.booking.findMany({
      where: {
        agencyId: agency.id,
        status: {
          not: BookingStatus.CANCELLED as unknown as import('@prisma/client').BookingStatus,
        },
      },
      include: {
        package: true,
        payments: {
          where: {
            status: PaymentStatus.SUCCEEDED as unknown as PrismaPaymentStatus,
          },
        },
        savingsPlan: true,
      },
    });

    let totalExpected = 0;
    let totalCollected = 0;
    let outstandingBalance = 0;

    const projectionsMap = new Map<string, number>();

    for (const booking of bookings) {
      const price = booking.package.price;
      const collected = booking.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, price - collected);

      totalExpected += price;
      totalCollected += collected;
      outstandingBalance += balance;

      if (balance > 0) {
        if (
          booking.savingsPlan &&
          booking.savingsPlan.autoDeduct &&
          booking.savingsPlan.deductAmount &&
          booking.savingsPlan.nextDeductDate &&
          booking.savingsPlan.frequency
        ) {
          let currentBalance = balance;
          const currentDate = new Date(booking.savingsPlan.nextDeductDate);

          while (
            currentBalance > 0 &&
            currentDate < booking.package.startDate
          ) {
            const amountToDeduct = Math.min(
              currentBalance,
              booking.savingsPlan.deductAmount,
            );
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            projectionsMap.set(
              monthKey,
              (projectionsMap.get(monthKey) || 0) + amountToDeduct,
            );

            currentBalance -= amountToDeduct;
            if (booking.savingsPlan.frequency === 'weekly') {
              currentDate.setDate(currentDate.getDate() + 7);
            } else {
              currentDate.setMonth(currentDate.getMonth() + 1);
            }
          }

          if (currentBalance > 0) {
            const monthKey = `${booking.package.startDate.getFullYear()}-${String(booking.package.startDate.getMonth() + 1).padStart(2, '0')}`;
            projectionsMap.set(
              monthKey,
              (projectionsMap.get(monthKey) || 0) + currentBalance,
            );
          }
        } else {
          const dueDate = balanceDueDate(booking.package.startDate);

          const effectiveDate = dueDate < new Date() ? new Date() : dueDate;
          const monthKey = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}`;

          projectionsMap.set(
            monthKey,
            (projectionsMap.get(monthKey) || 0) + balance,
          );
        }
      }
    }

    const projections = Array.from(projectionsMap.entries())
      .map(([month, expectedAmount]) => ({ month, expectedAmount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalExpected,
      totalCollected,
      outstandingBalance,
      projections,
    };
  }
}
