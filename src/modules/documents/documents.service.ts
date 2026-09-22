import {
  ForbiddenException,
  Inject,
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
import {
  DocumentExpiryAlertShape,
  DocumentExpiryStatus,
  PilgrimDocumentShape,
} from '../../types/document.types';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import {
  AccessUrl,
  StorageProvider,
  StoredFile,
  STORAGE_PROVIDER,
} from '../storage/storage-provider.interface';

const REQUIRED_TYPES = Object.values(PilgrimDocumentType);

// Idée #59 (backlog "Cent Fonctionnalités") : exigence courante (de
// nombreux pays/visas, dont l'Arabie saoudite) qu'un passeport reste valide
// au moins 6 mois après la date de retour — un repère à confirmer au cas
// par cas avec l'agence/l'ambassade, pas une garantie légale absolue.
const PASSPORT_VALIDITY_MARGIN_DAYS = 180;

function toDocumentShape(doc: PrismaPilgrimDocument): PilgrimDocumentShape {
  return {
    id: doc.id,
    bookingId: doc.bookingId,
    pilgrimId: doc.pilgrimId,
    type: doc.type as unknown as PilgrimDocumentType,
    storageRef: doc.storageRef,
    status: doc.status as unknown as PilgrimDocumentStatus,
    rejectionReason: doc.rejectionReason ?? undefined,
    expiresAt: doc.expiresAt ?? undefined,
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
    private readonly packagesService: PackagesService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async upload(
    pilgrimId: string,
    dto: UploadDocumentDto,
    file: StoredFile,
  ): Promise<PilgrimDocumentShape> {
    const booking = await this.bookingsService.findByIdOrFail(dto.bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    const { storageRef } = await this.storageProvider.store(
      pilgrimId,
      dto.type,
      file,
    );

    const doc = await this.prisma.pilgrimDocument.create({
      data: {
        bookingId: booking.id,
        pilgrimId,
        type: dto.type as unknown as PrismaPilgrimDocumentType,
        storageRef,
        status:
          PilgrimDocumentStatus.PENDING as unknown as PrismaPilgrimDocumentStatus,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
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

  async getAccessUrl(
    requesterId: string,
    requesterRole: 'pilgrim' | 'agency',
    documentId: string,
  ): Promise<AccessUrl> {
    const doc = await this.findByIdOrFail(documentId);
    const booking = await this.bookingsService.findByIdOrFail(doc.bookingId);

    if (requesterRole === 'pilgrim' && booking.pilgrimId !== requesterId) {
      throw new ForbiddenException('Ce document ne vous appartient pas');
    }
    if (requesterRole === 'agency') {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (booking.agencyId !== agency.id) {
        throw new ForbiddenException(
          "Ce document n'appartient pas à votre agence",
        );
      }
    }

    this.accessLogger.log(
      `Génération URL d'accès — demandeur=${requesterId} (${requesterRole}) document=${documentId}`,
    );
    return this.storageProvider.getAccessUrl(doc.storageRef);
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

  // Idée #59 (backlog "Cent Fonctionnalités") : croise la date d'expiration
  // déclarée de chaque document avec les dates réelles du voyage. Ne
  // remonte que ce qui nécessite une action — jamais d'alerte pour un
  // document sans date d'expiration connue (voir DocumentExpiryAlertShape).
  async getExpiryAlerts(
    requesterId: string,
    requesterRole: 'pilgrim' | 'agency',
    bookingId: string,
  ): Promise<DocumentExpiryAlertShape[]> {
    const docs = await this.findByBooking(
      requesterId,
      requesterRole,
      bookingId,
    );
    const booking = await this.bookingsService.findByIdOrFail(bookingId);
    const pkg = await this.packagesService.findByIdOrFail(booking.packageId);

    const now = Date.now();
    const tripEnd = pkg.endDate.getTime();
    const margeMs = PASSPORT_VALIDITY_MARGIN_DAYS * 24 * 60 * 60 * 1000;

    const alerts: DocumentExpiryAlertShape[] = [];
    for (const doc of docs) {
      if (!doc.expiresAt) {
        continue;
      }
      const expiresAtMs = doc.expiresAt.getTime();

      let status: DocumentExpiryStatus | undefined;
      if (expiresAtMs < now) {
        status = 'expired';
      } else if (expiresAtMs < tripEnd) {
        status = 'expires_before_trip';
      } else if (
        doc.type === PilgrimDocumentType.PASSPORT &&
        expiresAtMs < tripEnd + margeMs
      ) {
        status = 'expires_soon_after_trip';
      }

      if (status) {
        alerts.push({
          id: doc.id,
          type: doc.type,
          expiresAt: doc.expiresAt,
          status,
        });
      }
    }
    return alerts;
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
