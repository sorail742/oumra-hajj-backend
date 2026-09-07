import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { DossierStepKey } from '../bookings/schemas/booking.schema';
import { UploadDocumentDto } from './dto/upload-document.dto';
import {
  PilgrimDocument,
  PilgrimDocumentDocument,
  PilgrimDocumentStatus,
  PilgrimDocumentType,
} from './schemas/document.schema';

const REQUIRED_TYPES = Object.values(PilgrimDocumentType);

@Injectable()
export class DocumentsService {
  // Journalisation des accès aux documents sensibles — voir ADR 0008.
  private readonly accessLogger = new Logger('DocumentAccess');

  constructor(
    @InjectModel(PilgrimDocument.name)
    private readonly documentModel: Model<PilgrimDocumentDocument>,
    private readonly bookingsService: BookingsService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async upload(
    pilgrimId: string,
    dto: UploadDocumentDto,
  ): Promise<PilgrimDocumentDocument> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrim.toString() !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    return this.documentModel.create({
      booking: booking._id,
      pilgrim: pilgrimId,
      type: dto.type,
      storageRef: dto.storageRef,
      status: PilgrimDocumentStatus.PENDING,
    });
  }

  async findMine(pilgrimId: string): Promise<PilgrimDocumentDocument[]> {
    this.accessLogger.log(`Lecture (propriétaire) — pèlerin=${pilgrimId}`);
    return this.documentModel.find({ pilgrim: pilgrimId }).exec();
  }

  async findByBooking(
    requesterId: string,
    requesterRole: 'pilgrim' | 'agency',
    bookingId: string,
  ): Promise<PilgrimDocumentDocument[]> {
    const booking = await this.bookingsService.findByIdOrFail(bookingId);

    if (
      requesterRole === 'pilgrim' &&
      booking.pilgrim.toString() !== requesterId
    ) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (requesterRole === 'agency') {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (!booking.agency.equals(agency._id as Types.ObjectId)) {
        throw new ForbiddenException(
          "Cette réservation n'appartient pas à votre agence",
        );
      }
    }

    this.accessLogger.log(
      `Lecture — demandeur=${requesterId} (${requesterRole}) réservation=${bookingId}`,
    );
    return this.documentModel.find({ booking: booking._id }).exec();
  }

  async validate(
    ownerId: string,
    documentId: string,
  ): Promise<PilgrimDocumentDocument> {
    const doc = await this.findByIdOrFail(documentId);
    await this.assertAgencyOwnership(ownerId, doc);

    doc.status = PilgrimDocumentStatus.VALIDATED;
    doc.rejectionReason = undefined;
    await doc.save();

    await this.maybeCompleteDocumentsStep(doc.booking.toString());
    return doc;
  }

  async reject(
    ownerId: string,
    documentId: string,
    reason: string,
  ): Promise<PilgrimDocumentDocument> {
    const doc = await this.findByIdOrFail(documentId);
    await this.assertAgencyOwnership(ownerId, doc);

    doc.status = PilgrimDocumentStatus.REJECTED;
    doc.rejectionReason = reason;
    return doc.save();
  }

  private findByIdOrFail(id: string): Promise<PilgrimDocumentDocument> {
    return this.documentModel
      .findById(id)
      .exec()
      .then((doc) => {
        if (!doc) {
          throw new NotFoundException('Document introuvable');
        }
        return doc;
      });
  }

  private async assertAgencyOwnership(
    ownerId: string,
    doc: PilgrimDocumentDocument,
  ): Promise<void> {
    const booking = await this.bookingsService.findByIdOrFail(
      doc.booking.toString(),
    );
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (!booking.agency.equals(agency._id as Types.ObjectId)) {
      throw new ForbiddenException(
        "Ce document n'appartient pas à votre agence",
      );
    }
  }

  private async maybeCompleteDocumentsStep(bookingId: string): Promise<void> {
    const docs = await this.documentModel
      .find({ booking: new Types.ObjectId(bookingId) })
      .exec();
    const validatedTypes = new Set(
      docs
        .filter((d) => d.status === PilgrimDocumentStatus.VALIDATED)
        .map((d) => d.type),
    );
    const allValidated = REQUIRED_TYPES.every((type) =>
      validatedTypes.has(type),
    );
    if (allValidated) {
      await this.bookingsService.markStepDone(
        bookingId,
        DossierStepKey.DOCUMENTS,
      );
    }
  }
}
