import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Payment as PrismaPayment,
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Role } from '../../common/enums/role.enum';
import { PaymentShape } from '../../types/payment.types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

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
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly packagesService: PackagesService,
    private readonly agenciesService: AgenciesService,
  ) {}

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

    // Référence provisoire tant qu'aucun agrégateur Mobile Money/carte n'est
    // intégré (voir ADR 0006) — à remplacer par la référence retournée par
    // l'appel d'initiation réel du prestataire.
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: dto.amount,
        installmentNumber,
        method: dto.method as unknown as PrismaPaymentMethod,
        status: PaymentStatus.PENDING as unknown as PrismaPaymentStatus,
        providerReference: `dev-${randomUUID()}`,
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
}
