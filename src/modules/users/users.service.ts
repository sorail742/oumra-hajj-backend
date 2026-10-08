import { Injectable, NotFoundException } from '@nestjs/common';
import {
  User as PrismaUser,
  Role as PrismaRole,
  SpecialNeeds as PrismaSpecialNeeds,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';
import {
  MobilityLevel,
  SpecialNeedsShape,
  UserShape,
  UserSummaryShape,
} from '../../types/user.types';
import { CreateUserInternalDto } from './dto/create-user-internal.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSpecialNeedsDto } from './dto/update-special-needs.dto';

// Le stockage Postgres est plat (emergencyContact* en colonnes séparées,
// voir schema.prisma) mais le contrat public (src/types/user.types.ts)
// expose un objet emergencyContact imbriqué — ce mapper fait la conversion
// dans les deux sens pour ne pas changer la forme de l'API.
type UserRecord = Omit<PrismaUser, 'passwordHash'>;
export type UserWithPassword = PrismaUser;

export function toUserSummary(user: UserShape): UserSummaryShape {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function toUserShape(user: UserRecord): UserShape {
  const hasEmergencyContact =
    user.emergencyContactFullName !== null ||
    user.emergencyContactPhone !== null;

  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
    role: user.role as unknown as Role,
    preferredLanguage: user.preferredLanguage,
    emergencyContact: hasEmergencyContact
      ? {
          fullName: user.emergencyContactFullName ?? '',
          phone: user.emergencyContactPhone ?? '',
          relationship: user.emergencyContactRelationship ?? undefined,
        }
      : undefined,
    bloodType: user.bloodType ?? undefined,
    passportNumber: user.passportNumber ?? undefined,
    agencyId: user.agencyId ?? undefined,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Chaîne vide ou absente → null : rien de vide n'est stocké. */
function texteOuNull(valeur: string | undefined): string | null {
  const nettoye = valeur?.trim();
  return nettoye ? nettoye : null;
}

export function toSpecialNeedsShape(
  besoins: PrismaSpecialNeeds,
): SpecialNeedsShape {
  return {
    mobility: besoins.mobility as MobilityLevel,
    dietary: besoins.dietary ?? undefined,
    medical: besoins.medical ?? undefined,
    assistance: besoins.assistance ?? undefined,
    updatedAt: besoins.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserInternalDto): Promise<UserShape> {
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        passwordHash: dto.passwordHash,
        role: dto.role as unknown as PrismaRole,
        agencyId: dto.agencyId,
      },
    });
    return toUserShape(user);
  }

  async findById(id: string): Promise<UserShape | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUserShape(user) : null;
  }

  async findByIdOrFail(id: string): Promise<UserShape> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  async findByPhone(phone: string): Promise<UserShape | null> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    return user ? toUserShape(user) : null;
  }

  async findByEmail(email: string): Promise<UserShape | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? toUserShape(user) : null;
  }

  // Seule méthode à ré-inclure passwordHash (omis par défaut, voir
  // PrismaService) — nécessaire pour vérifier le mot de passe au login.
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      omit: { passwordHash: false },
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserShape> {
    const { emergencyContact, ...rest } = dto;
    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...rest,
          ...(emergencyContact && {
            emergencyContactFullName: emergencyContact.fullName,
            emergencyContactPhone: emergencyContact.phone,
            emergencyContactRelationship: emergencyContact.relationship,
          }),
        },
      })
      .catch(() => {
        throw new NotFoundException('Utilisateur introuvable');
      });
    return toUserShape(user);
  }

  async setActive(userId: string, isActive: boolean): Promise<UserShape> {
    const user = await this.prisma.user
      .update({ where: { id: userId }, data: { isActive } })
      .catch(() => {
        throw new NotFoundException('Utilisateur introuvable');
      });
    return toUserShape(user);
  }

  async findByRole(role: Role, agencyId?: string): Promise<UserShape[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: role as unknown as PrismaRole,
        ...(agencyId && { agencyId }),
      },
    });
    return users.map(toUserShape);
  }

  // Administration (cahier des charges §3.4) : vue minimale des comptes.
  async listForAdmin(
    role: Role,
    agencyId?: string,
  ): Promise<UserSummaryShape[]> {
    return (await this.findByRole(role, agencyId)).map(toUserSummary);
  }

  async setActiveForAdmin(
    userId: string,
    isActive: boolean,
  ): Promise<UserSummaryShape> {
    return toUserSummary(await this.setActive(userId, isActive));
  }

  // Idée #69 — besoins spéciaux. Le contenu n'est jamais journalisé.
  async getSpecialNeeds(userId: string): Promise<SpecialNeedsShape> {
    const besoins = await this.prisma.specialNeeds.findUnique({
      where: { userId },
    });
    return besoins ? toSpecialNeedsShape(besoins) : { mobility: 'none' };
  }

  async replaceSpecialNeeds(
    userId: string,
    dto: UpdateSpecialNeedsDto,
  ): Promise<SpecialNeedsShape> {
    const donnees = {
      mobility: dto.mobility,
      dietary: texteOuNull(dto.dietary),
      medical: texteOuNull(dto.medical),
      assistance: texteOuNull(dto.assistance),
    };
    const besoins = await this.prisma.specialNeeds.upsert({
      where: { userId },
      create: { userId, ...donnees },
      update: donnees,
    });
    return toSpecialNeedsShape(besoins);
  }
}
