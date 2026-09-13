import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Agency as PrismaAgency,
  AgencyLegalDocument as PrismaAgencyLegalDocument,
  AgencyValidationStatus as PrismaAgencyValidationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { Role } from '../../common/enums/role.enum';
import {
  AgencyShape,
  CalendarSubscriptionShape,
  LegalDocumentAlertShape,
  LegalDocumentComplianceStatus,
} from '../../types/agency.types';
import {
  AccessUrl,
  StorageProvider,
  StoredFile,
  STORAGE_PROVIDER,
} from '../storage/storage-provider.interface';
import { UsersService } from '../users/users.service';
import { AddLegalDocumentDto } from './dto/add-legal-document.dto';
import { RegisterAgencyDto } from './dto/register-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

const SALT_ROUNDS = 12;
// Idée #56 : document signalé "à revalider bientôt" à partir de cette
// fenêtre avant expiration — évite qu'il ne bloque une opération le jour J.
const COMPLIANCE_ALERT_WINDOW_DAYS = 30;
const LEGAL_DOCUMENT_TYPE = 'agency_legal_document';

type AgencyRecord = PrismaAgency & {
  legalDocuments: PrismaAgencyLegalDocument[];
};

// Chemin en dur comme LocalDiskStorageProvider.getAccessUrl — le client
// compose avec sa propre base, cohérent avec l'existant plutôt qu'une
// nouvelle façon de résoudre l'URL publique de l'API.
function toCalendarSubscriptionShape(token: string): CalendarSubscriptionShape {
  return {
    token,
    subscriptionUrl: `/api/v1/calendar/agency/${token}/calendar.ics`,
  };
}

function toAgencyShape(agency: AgencyRecord): AgencyShape {
  const hasBankDetails =
    agency.bankAccountName !== null ||
    agency.bankAccountNumber !== null ||
    agency.bankName !== null;

  return {
    id: agency.id,
    legalName: agency.legalName,
    ownerId: agency.ownerId,
    contactEmail: agency.contactEmail,
    contactPhone: agency.contactPhone,
    address: agency.address ?? undefined,
    legalDocuments: agency.legalDocuments.map((doc) => ({
      id: doc.id,
      label: doc.label,
      storageRef: doc.storageRef,
      uploadedAt: doc.uploadedAt,
      expiresAt: doc.expiresAt ?? undefined,
    })),
    validationStatus:
      agency.validationStatus as unknown as AgencyValidationStatus,
    rejectionReason: agency.rejectionReason ?? undefined,
    validatedById: agency.validatedById ?? undefined,
    validatedAt: agency.validatedAt ?? undefined,
    commissionRate: agency.commissionRate,
    bankDetails: hasBankDetails
      ? {
          accountName: agency.bankAccountName ?? '',
          accountNumber: agency.bankAccountNumber ?? '',
          bankName: agency.bankName ?? '',
        }
      : undefined,
  };
}

@Injectable()
export class AgenciesService {
  // Journalisation des accès aux documents légaux agence — voir ADR 0008.
  private readonly accessLogger = new Logger('AgencyLegalDocumentAccess');

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async register(dto: RegisterAgencyDto): Promise<AgencyShape> {
    const existing = await this.usersService.findByEmail(dto.contactEmail);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const owner = await this.usersService.create({
      fullName: dto.legalName,
      email: dto.contactEmail,
      passwordHash,
      role: Role.AGENCY,
    });

    const agency = await this.prisma.agency.create({
      data: {
        legalName: dto.legalName,
        ownerId: owner.id,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        address: dto.address,
        validationStatus:
          AgencyValidationStatus.PENDING as unknown as PrismaAgencyValidationStatus,
      },
      include: { legalDocuments: true },
    });
    return toAgencyShape(agency);
  }

  async findByOwnerOrFail(ownerId: string): Promise<AgencyShape> {
    const agency = await this.prisma.agency.findUnique({
      where: { ownerId },
      include: { legalDocuments: true },
    });
    if (!agency) {
      throw new NotFoundException('Agence introuvable');
    }
    return toAgencyShape(agency);
  }

  async findByIdOrFail(id: string): Promise<AgencyShape> {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: { legalDocuments: true },
    });
    if (!agency) {
      throw new NotFoundException('Agence introuvable');
    }
    return toAgencyShape(agency);
  }

  async findByStatus(status?: AgencyValidationStatus): Promise<AgencyShape[]> {
    const agencies = await this.prisma.agency.findMany({
      where: status
        ? {
            validationStatus: status as unknown as PrismaAgencyValidationStatus,
          }
        : {},
      include: { legalDocuments: true },
    });
    return agencies.map(toAgencyShape);
  }

  async updateOwn(ownerId: string, dto: UpdateAgencyDto): Promise<AgencyShape> {
    const owned = await this.findByOwnerOrFail(ownerId);
    const agency = await this.prisma.agency.update({
      where: { id: owned.id },
      data: {
        address: dto.address,
        ...(dto.bankDetails && {
          bankAccountName: dto.bankDetails.accountName,
          bankAccountNumber: dto.bankDetails.accountNumber,
          bankName: dto.bankDetails.bankName,
        }),
      },
      include: { legalDocuments: true },
    });
    return toAgencyShape(agency);
  }

  async approve(id: string, adminId: string): Promise<AgencyShape> {
    const agency = await this.prisma.agency
      .update({
        where: { id },
        data: {
          validationStatus:
            AgencyValidationStatus.APPROVED as unknown as PrismaAgencyValidationStatus,
          validatedById: adminId,
          validatedAt: new Date(),
          rejectionReason: null,
        },
        include: { legalDocuments: true },
      })
      .catch(() => {
        throw new NotFoundException('Agence introuvable');
      });
    return toAgencyShape(agency);
  }

  async reject(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<AgencyShape> {
    const agency = await this.prisma.agency
      .update({
        where: { id },
        data: {
          validationStatus:
            AgencyValidationStatus.REJECTED as unknown as PrismaAgencyValidationStatus,
          validatedById: adminId,
          validatedAt: new Date(),
          rejectionReason: reason,
        },
        include: { legalDocuments: true },
      })
      .catch(() => {
        throw new NotFoundException('Agence introuvable');
      });
    return toAgencyShape(agency);
  }

  // Statistiques globales admin — cahier des charges §3.4.
  async countByStatus(): Promise<Record<AgencyValidationStatus, number>> {
    const statuses = Object.values(AgencyValidationStatus);
    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.agency.count({
          where: {
            validationStatus: status as unknown as PrismaAgencyValidationStatus,
          },
        }),
      ),
    );
    return Object.fromEntries(
      statuses.map((status, i) => [status, counts[i]]),
    ) as Record<AgencyValidationStatus, number>;
  }

  async assertApproved(agencyId: string): Promise<void> {
    const agency = await this.findByIdOrFail(agencyId);
    if (agency.validationStatus !== AgencyValidationStatus.APPROVED) {
      throw new ConflictException(
        "L'agence n'est pas encore validée par l'administrateur",
      );
    }
  }

  // Idée #56 (backlog "Cent Fonctionnalités") : ajout d'un document légal
  // (registre de commerce, agrément, assurance...) avec date d'expiration
  // optionnelle, pour permettre les alertes de conformité ci-dessous.
  async addLegalDocument(
    ownerId: string,
    dto: AddLegalDocumentDto,
    file: StoredFile,
  ): Promise<AgencyShape> {
    const owned = await this.findByOwnerOrFail(ownerId);

    const { storageRef } = await this.storageProvider.store(
      owned.id,
      LEGAL_DOCUMENT_TYPE,
      file,
    );

    await this.prisma.agencyLegalDocument.create({
      data: {
        agencyId: owned.id,
        label: dto.label,
        storageRef,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return this.findByIdOrFail(owned.id);
  }

  // Ne remonte que les documents nécessitant une action — jamais de statut
  // fabriqué pour un document sans date d'expiration connue.
  async getComplianceAlerts(
    ownerId: string,
  ): Promise<LegalDocumentAlertShape[]> {
    const owned = await this.findByOwnerOrFail(ownerId);
    const now = Date.now();
    const alertThreshold =
      now + COMPLIANCE_ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    return owned.legalDocuments
      .filter((doc): doc is typeof doc & { expiresAt: Date } =>
        Boolean(doc.expiresAt),
      )
      .map((doc) => {
        const status: LegalDocumentComplianceStatus =
          doc.expiresAt.getTime() < now ? 'expired' : 'expiring_soon';
        return {
          id: doc.id,
          label: doc.label,
          expiresAt: doc.expiresAt,
          status,
        };
      })
      .filter(
        (alert) =>
          alert.status === 'expired' ||
          alert.expiresAt.getTime() <= alertThreshold,
      );
  }

  async getLegalDocumentAccessUrl(
    ownerId: string,
    documentId: string,
  ): Promise<AccessUrl> {
    const owned = await this.findByOwnerOrFail(ownerId);
    const doc = owned.legalDocuments.find((d) => d.id === documentId);
    if (!doc) {
      throw new ForbiddenException('Ce document ne vous appartient pas');
    }

    this.accessLogger.log(
      `Génération URL d'accès — agence=${owned.id} document=${documentId}`,
    );
    return this.storageProvider.getAccessUrl(doc.storageRef);
  }

  // Idée #70 (backlog "Cent Fonctionnalités") : jeton opaque et non expirant
  // — Google/Outlook ne peuvent pas envoyer d'en-tête Authorization sur une
  // URL d'abonnement calendrier, contrairement aux URL de documents signées
  // à courte durée de vie (ADR 0008) qui restent, elles, inchangées.
  async getOrCreateCalendarSubscription(
    ownerId: string,
  ): Promise<CalendarSubscriptionShape> {
    const raw = await this.prisma.agency.findUnique({ where: { ownerId } });
    if (!raw) {
      throw new NotFoundException('Agence introuvable');
    }
    if (raw.calendarToken) {
      return toCalendarSubscriptionShape(raw.calendarToken);
    }
    return this.regenerateCalendarSubscription(ownerId);
  }

  // Révoque l'ancienne URL d'abonnement (si le jeton a fuité) en la
  // remplaçant par une nouvelle.
  async regenerateCalendarSubscription(
    ownerId: string,
  ): Promise<CalendarSubscriptionShape> {
    const owned = await this.findByOwnerOrFail(ownerId);
    const token = randomBytes(24).toString('hex');
    await this.prisma.agency.update({
      where: { id: owned.id },
      data: { calendarToken: token },
    });
    return toCalendarSubscriptionShape(token);
  }

  async findByCalendarTokenOrFail(token: string): Promise<AgencyShape> {
    const agency = await this.prisma.agency.findUnique({
      where: { calendarToken: token },
      include: { legalDocuments: true },
    });
    if (!agency) {
      throw new NotFoundException('Lien de calendrier invalide');
    }
    return toAgencyShape(agency);
  }
}
