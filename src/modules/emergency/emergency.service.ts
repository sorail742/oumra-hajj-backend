import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus as PrismaBookingStatus,
  EmergencyNumber as PrismaEmergencyNumber,
} from '@prisma/client';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EmergencyCategory,
  EmergencyGuideContactShape,
  EmergencyNumberShape,
  MyEmergencyContactsShape,
} from '../../types/emergency.types';
import { CreateEmergencyNumberDto } from './dto/create-emergency-number.dto';
import { UpdateEmergencyNumberDto } from './dto/update-emergency-number.dto';

function toEmergencyNumberShape(
  numero: PrismaEmergencyNumber,
): EmergencyNumberShape {
  return {
    id: numero.id,
    label: numero.label,
    category: numero.category as EmergencyCategory,
    phone: numero.phone,
    country: numero.country,
    city: numero.city ?? undefined,
    notes: numero.notes ?? undefined,
    order: numero.order,
  };
}

const CANCELLED = BookingStatus.CANCELLED as unknown as PrismaBookingStatus;

// Idée #21 (backlog "Cent Fonctionnalités") — numéros d'urgence : un
// annuaire saisi par l'administration (aucun numéro codé en dur) et les
// contacts personnels de l'utilisateur (son agence, son guide), déduits de
// ses réservations actives et de ses groupes.
@Injectable()
export class EmergencyService {
  constructor(private readonly prisma: PrismaService) {}

  async listNumbers(): Promise<EmergencyNumberShape[]> {
    const numeros = await this.prisma.emergencyNumber.findMany({
      orderBy: [{ order: 'asc' }, { label: 'asc' }],
    });
    return numeros.map(toEmergencyNumberShape);
  }

  async createNumber(
    dto: CreateEmergencyNumberDto,
  ): Promise<EmergencyNumberShape> {
    const numero = await this.prisma.emergencyNumber.create({ data: dto });
    return toEmergencyNumberShape(numero);
  }

  async updateNumber(
    id: string,
    dto: UpdateEmergencyNumberDto,
  ): Promise<EmergencyNumberShape> {
    await this.findNumberOrFail(id);
    const numero = await this.prisma.emergencyNumber.update({
      where: { id },
      data: dto,
    });
    return toEmergencyNumberShape(numero);
  }

  async deleteNumber(id: string): Promise<void> {
    await this.findNumberOrFail(id);
    await this.prisma.emergencyNumber.delete({ where: { id } });
  }

  // Pèlerin : agences de ses réservations non annulées et guides des
  // groupes où il est rattaché. Guide : agences de ses groupes.
  async findMyContacts(userId: string): Promise<MyEmergencyContactsShape> {
    const [reservations, groupesGuides] = await Promise.all([
      this.prisma.booking.findMany({
        where: { pilgrimId: userId, status: { not: CANCELLED } },
        include: {
          agency: true,
          group: { include: { guide: true } },
        },
      }),
      this.prisma.group.findMany({
        where: { guideId: userId },
        include: { agency: true },
      }),
    ]);

    const agences = new Map<
      string,
      MyEmergencyContactsShape['agencies'][number]
    >();
    const guides = new Map<string, EmergencyGuideContactShape>();

    for (const { agency } of [...reservations, ...groupesGuides]) {
      agences.set(agency.id, {
        agencyId: agency.id,
        legalName: agency.legalName,
        phone: agency.contactPhone,
      });
    }
    for (const { group } of reservations) {
      if (group?.guide) {
        guides.set(group.id, {
          groupId: group.id,
          groupTitle: group.title,
          fullName: group.guide.fullName,
          phone: group.guide.phone ?? undefined,
        });
      }
    }

    return { agencies: [...agences.values()], guides: [...guides.values()] };
  }

  private async findNumberOrFail(id: string): Promise<PrismaEmergencyNumber> {
    const numero = await this.prisma.emergencyNumber.findUnique({
      where: { id },
    });
    if (!numero) {
      throw new NotFoundException("Numéro d'urgence introuvable");
    }
    return numero;
  }
}
