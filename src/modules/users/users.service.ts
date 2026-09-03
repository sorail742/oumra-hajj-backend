import { Injectable, NotFoundException } from '@nestjs/common';
import { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';
import { UserShape } from '../../types/user.types';
import { CreateUserInternalDto } from './dto/create-user-internal.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Le stockage Postgres est plat (emergencyContact* en colonnes séparées,
// voir schema.prisma) mais le contrat public (src/types/user.types.ts)
// expose un objet emergencyContact imbriqué — ce mapper fait la conversion
// dans les deux sens pour ne pas changer la forme de l'API.
type UserRecord = Omit<PrismaUser, 'passwordHash'>;
export type UserWithPassword = PrismaUser;

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
}
