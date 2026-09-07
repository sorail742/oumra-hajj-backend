import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PilgrimDocument as PrismaPilgrimDocument,
  PilgrimDocumentStatus as PrismaPilgrimDocumentStatus,
  PilgrimDocumentType as PrismaPilgrimDocumentType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { PilgrimDocumentStatus } from '../../common/enums/pilgrim-document-status.enum';
import { PilgrimDocumentType } from '../../common/enums/pilgrim-document-type.enum';
import { PilgrimDocumentShape } from '../../types/document.types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

const REQUIRED_TYPES = Object.values(PilgrimDocumentType);

function toDocumentShape(doc: PrismaPilgrimDocument): PilgrimDocumentShape {
  return {
    id: doc.id,
    bookingId: doc.bookingId,
    pilgrimId: doc.pilgrimId,
    type: doc.type as unknown as PilgrimDocumentType,
    storageRef: doc.storageRef,
    status: doc.status as unknown as PilgrimDocumentStatus,
    rejectionReason: doc.rejectionReason ?? undefined,
  };
}

@Injectable()
export class DocumentsService {
  // Journalisation des accès aux documents sensibles — voir ADR 0008.
  private readonly accessLogger = new Logger('DocumentAccess');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async upload(
    pilgrimId: string,
    dto: UploadDocumentDto,
  ): Promise<PilgrimDocumentShape> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    const doc = await this.prisma.pilgrimDocument.create({
      data: {
        bookingId: booking.id,
        pilgrimId,
        type: dto.type as unknown as PrismaPilgrimDocumentType,
        storageRef: dto.storageRef,
        status:
          PilgrimDocumentStatus.PENDING as unknown as PrismaPilgrimDocumentStatus,
      },
    });
    return toDocumentShape(doc);
  }

  async findMine(pilgrimId: string): Promise<PilgrimDocumentShape[]> {
    this.accessLogger.log(`Lecture (propriétaire) — pèlerin=${pilgrimId}`);
    const docs = await this.prisma.pilgrimDocument.findMany({
      where: { pilgrimId },
    });
    return docs.map(toDocumentShape);
  }

  async findByBooking(
    requesterId: string,
    requesterRole: 'pilgrim' | 'agency',
    bookingId: string,
  ): Promise<PilgrimDocumentShape[]> {
    const booking = await this.bookingsService.findByIdOrFail(bookingId);

    if (requesterRole === 'pilgrim' && booking.pilgrimId !== requesterId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (requesterRole === 'agency') {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (booking.agencyId !== agency.id) {
        throw new ForbiddenException(
          "Cette réservation n'appartient pas à votre agence",
        );
      }
    }

    this.accessLogger.log(
      `Lecture — demandeur=${requesterId} (${requesterRole}) réservation=${bookingId}`,
    );
    const docs = await this.prisma.pilgrimDocument.findMany({
      where: { bookingId: booking.id },
    });
    return docs.map(toDocumentShape);
  }

  async validate(
    ownerId: string,
    documentId: string,
  ): Promise<PilgrimDocumentShape> {
    const doc = await this.findByIdOrFail(documentId);
    await this.assertAgencyOwnership(ownerId, doc);

    const updated = await this.prisma.pilgrimDocument.update({
      where: { id: doc.id },
      data: {
        status:
          PilgrimDocumentStatus.VALIDATED as unknown as PrismaPilgrimDocumentStatus,
        rejectionReason: null,
      },
    });

    await this.maybeCompleteDocumentsStep(updated.bookingId);
    return toDocumentShape(updated);
  }

  async reject(
    ownerId: string,
    documentId: string,
    reason: string,
  ): Promise<PilgrimDocumentShape> {
    const doc = await this.findByIdOrFail(documentId);
    await this.assertAgencyOwnership(ownerId, doc);

    const updated = await this.prisma.pilgrimDocument.update({
      where: { id: doc.id },
      data: {
        status:
          PilgrimDocumentStatus.REJECTED as unknown as PrismaPilgrimDocumentStatus,
        rejectionReason: reason,
      },
    });
    return toDocumentShape(updated);
  }

  private async findByIdOrFail(id: string): Promise<PilgrimDocumentShape> {
    const doc = await this.prisma.pilgrimDocument.findUnique({
      where: { id },
    });
    if (!doc) {
      throw new NotFoundException('Document introuvable');
    }
    return toDocumentShape(doc);
  }

  private async assertAgencyOwnership(
    ownerId: string,
    doc: PilgrimDocumentShape,
  ): Promise<void> {
    const booking = await this.bookingsService.findByIdOrFail(doc.bookingId);
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (booking.agencyId !== agency.id) {
      throw new ForbiddenException(
        "Ce document n'appartient pas à votre agence",
      );
    }
  }

  private async maybeCompleteDocumentsStep(bookingId: string): Promise<void> {
    const docs = await this.prisma.pilgrimDocument.findMany({
      where: { bookingId },
    });
    const shapes = docs.map(toDocumentShape);
    const validatedTypes = new Set(
      shapes
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
