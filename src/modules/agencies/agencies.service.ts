import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Agency as PrismaAgency,
  AgencyLegalDocument as PrismaAgencyLegalDocument,
  AgencyValidationStatus as PrismaAgencyValidationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { Role } from '../../common/enums/role.enum';
import { AgencyShape } from '../../types/agency.types';
import { UsersService } from '../users/users.service';
import { RegisterAgencyDto } from './dto/register-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

const SALT_ROUNDS = 12;

type AgencyRecord = PrismaAgency & {
  legalDocuments: PrismaAgencyLegalDocument[];
};

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
      label: doc.label,
      storageRef: doc.storageRef,
      uploadedAt: doc.uploadedAt,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
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
}
