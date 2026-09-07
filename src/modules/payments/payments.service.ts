import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from './schemas/payment.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly bookingsService: BookingsService,
    private readonly packagesService: PackagesService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async initiate(
    pilgrimId: string,
    dto: InitiatePaymentDto,
  ): Promise<PaymentDocument> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    const installmentNumber =
      (await this.paymentModel.countDocuments({ booking: booking.id })) + 1;

    // Référence provisoire tant qu'aucun agrégateur Mobile Money/carte n'est
    // intégré (voir ADR 0006) — à remplacer par la référence retournée par
    // l'appel d'initiation réel du prestataire.
    return this.paymentModel.create({
      booking: booking.id,
      amount: dto.amount,
      installmentNumber,
      method: dto.method,
      status: PaymentStatus.PENDING,
      providerReference: `dev-${randomUUID()}`,
    });
  }

  findByIdOrFail(id: string): Promise<PaymentDocument> {
    return this.paymentModel
      .findById(id)
      .exec()
      .then((payment) => {
        if (!payment) {
          throw new NotFoundException('Paiement introuvable');
        }
        return payment;
      });
  }

  async findForPilgrim(pilgrimId: string): Promise<PaymentDocument[]> {
    const bookings = await this.bookingsService.findMine(pilgrimId);
    const bookingIds = bookings.map((b) => b.id);
    return this.paymentModel.find({ booking: { $in: bookingIds } }).exec();
  }

  async findAuthorizedOrFail(
    requesterId: string,
    requesterRole: Role,
    paymentId: string,
  ): Promise<PaymentDocument> {
    const payment = await this.findByIdOrFail(paymentId);
    const booking = await this.bookingsService.findByIdOrFail(
      payment.booking.toString(),
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

  findByBooking(bookingId: string): Promise<PaymentDocument[]> {
    return this.paymentModel.find({ booking: bookingId }).exec();
  }

  async findForAgency(ownerId: string): Promise<PaymentDocument[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const bookings = await this.bookingsService.findByAgency(ownerId);
    const bookingIds = bookings
      .filter((b) => b.agencyId === agency.id)
      .map((b) => b.id);
    return this.paymentModel.find({ booking: { $in: bookingIds } }).exec();
  }

  // Callback serveur-à-serveur du prestataire — voir ADR 0006.
  async handleWebhook(dto: PaymentWebhookDto): Promise<PaymentDocument> {
    const payment = await this.paymentModel
      .findOne({ providerReference: dto.providerReference })
      .exec();
    if (!payment) {
      throw new NotFoundException('Paiement introuvable pour cette référence');
    }

    payment.status = dto.status;
    if (dto.status === PaymentStatus.SUCCEEDED) {
      payment.confirmedAt = new Date();
      payment.receiptRef = `RCPT-${payment._id.toString()}`;
    }
    await payment.save();

    if (dto.status === PaymentStatus.SUCCEEDED) {
      await this.reconcileBookingPaymentStep(payment.booking.toString());
    }

    return payment;
  }

  // Supervision des paiements — cahier des charges §3.4.
  async sumSucceededAmount(): Promise<number> {
    const [result] = await this.paymentModel.aggregate<{ total: number }>([
      { $match: { status: PaymentStatus.SUCCEEDED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result?.total ?? 0;
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
