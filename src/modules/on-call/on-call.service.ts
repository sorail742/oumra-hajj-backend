import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus as PrismaBookingStatus, Prisma } from '@prisma/client';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MyOnCallShape,
  OnCallContactShape,
  OnCallCoverageShape,
  OnCallPeriodShape,
  OnCallRole,
  OnCallShiftShape,
} from '../../types/on-call.types';
import { AgenciesService } from '../agencies/agencies.service';
import { CreateOnCallShiftDto } from './dto/create-on-call-shift.dto';
import { ListOnCallShiftsQueryDto } from './dto/list-on-call-shifts-query.dto';
import { UpdateOnCallShiftDto } from './dto/update-on-call-shift.dto';

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;
// Au-delà, ce n'est plus un créneau d'astreinte mais une affectation.
export const MAX_SHIFT_DAYS = 14;

const CANCELLED = BookingStatus.CANCELLED as unknown as PrismaBookingStatus;

const AVEC_FORFAIT = {
  package: { select: { title: true } },
} satisfies Prisma.OnCallShiftInclude;

type Creneau = Prisma.OnCallShiftGetPayload<{ include: typeof AVEC_FORFAIT }>;

function toShiftShape(c: Creneau): OnCallShiftShape {
  return {
    id: c.id,
    packageId: c.packageId ?? undefined,
    packageTitle: c.package?.title,
    staffName: c.staffName,
    staffRole: c.staffRole as OnCallRole,
    phone: c.phone,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    notes: c.notes ?? undefined,
  };
}

function toContactShape(c: {
  staffName: string;
  staffRole: string;
  phone: string;
  startsAt: Date;
  endsAt: Date;
}): OnCallContactShape {
  return {
    staffName: c.staffName,
    staffRole: c.staffRole as OnCallRole,
    phone: c.phone,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
  };
}

/**
 * Périodes de [from, to[ couvertes par aucun créneau. Les créneaux peuvent
 * se chevaucher (deux personnes d'astreinte en même temps) ou déborder de
 * la fenêtre.
 */
export function trousDeCouverture(
  from: Date,
  to: Date,
  creneaux: { startsAt: Date; endsAt: Date }[],
): OnCallPeriodShape[] {
  const tries = [...creneaux].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  const trous: OnCallPeriodShape[] = [];
  let curseur = from.getTime();
  for (const c of tries) {
    if (curseur >= to.getTime()) break;
    const debut = c.startsAt.getTime();
    if (debut > curseur) {
      trous.push({
        from: new Date(curseur),
        to: new Date(Math.min(debut, to.getTime())),
      });
    }
    curseur = Math.max(curseur, c.endsAt.getTime());
  }
  if (curseur < to.getTime()) {
    trous.push({ from: new Date(curseur), to });
  }
  return trous;
}

function verifierPeriode(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new BadRequestException('La fin du créneau doit suivre son début');
  }
  if (endsAt.getTime() - startsAt.getTime() > MAX_SHIFT_DAYS * JOUR_MS) {
    throw new BadRequestException(
      `Un créneau d'astreinte dure au plus ${MAX_SHIFT_DAYS} jours`,
    );
  }
}

// Idée #63 (backlog "Cent Fonctionnalités") — astreinte 24/7 : l'agence
// planifie qui est joignable, quand, et pour quel voyage ; le pèlerin voit
// qui appeler maintenant, plutôt qu'un numéro qui ne répond pas le
// week-end. La couverture d'un voyage fait apparaître les heures du séjour
// où personne n'est d'astreinte.
@Injectable()
export class OnCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async listShifts(
    ownerId: string,
    query: ListOnCallShiftsQueryDto,
  ): Promise<OnCallShiftShape[]> {
    const agencyId = await this.agencyIdOf(ownerId);
    const creneaux = await this.prisma.onCallShift.findMany({
      where: {
        agencyId,
        endsAt: { gt: query.from ? new Date(query.from) : new Date() },
        ...(query.to && { startsAt: { lt: new Date(query.to) } }),
        ...(query.packageId && {
          OR: [{ packageId: query.packageId }, { packageId: null }],
        }),
      },
      include: AVEC_FORFAIT,
      orderBy: { startsAt: 'asc' },
    });
    return creneaux.map(toShiftShape);
  }

  async createShift(
    ownerId: string,
    dto: CreateOnCallShiftDto,
  ): Promise<OnCallShiftShape> {
    const agencyId = await this.agencyIdOf(ownerId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    verifierPeriode(startsAt, endsAt);
    if (dto.packageId) await this.assertOwnPackage(agencyId, dto.packageId);
    const creneau = await this.prisma.onCallShift.create({
      data: {
        agencyId,
        packageId: dto.packageId,
        staffName: dto.staffName,
        staffRole: dto.staffRole,
        phone: dto.phone,
        startsAt,
        endsAt,
        notes: dto.notes,
      },
      include: AVEC_FORFAIT,
    });
    return toShiftShape(creneau);
  }

  async updateShift(
    ownerId: string,
    id: string,
    dto: UpdateOnCallShiftDto,
  ): Promise<OnCallShiftShape> {
    const actuel = await this.findOwnedOrFail(ownerId, id);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : actuel.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : actuel.endsAt;
    verifierPeriode(startsAt, endsAt);
    const creneau = await this.prisma.onCallShift.update({
      where: { id },
      data: {
        staffName: dto.staffName,
        staffRole: dto.staffRole,
        phone: dto.phone,
        startsAt,
        endsAt,
        notes: dto.notes,
      },
      include: AVEC_FORFAIT,
    });
    return toShiftShape(creneau);
  }

  async deleteShift(ownerId: string, id: string): Promise<void> {
    await this.findOwnedOrFail(ownerId, id);
    await this.prisma.onCallShift.delete({ where: { id } });
  }

  /**
   * Couverture d'un voyage, du premier jour à minuit du dernier jour : les
   * créneaux du forfait et ceux valables pour tous les voyages comptent.
   */
  async getCoverage(
    ownerId: string,
    packageId: string,
  ): Promise<OnCallCoverageShape> {
    const agencyId = await this.agencyIdOf(ownerId);
    const forfait = await this.assertOwnPackage(agencyId, packageId);
    const from = forfait.startDate;
    const to = new Date(forfait.endDate.getTime() + JOUR_MS);
    const creneaux = await this.prisma.onCallShift.findMany({
      where: {
        agencyId,
        OR: [{ packageId }, { packageId: null }],
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    });
    const gaps = trousDeCouverture(from, to, creneaux);
    const totalMs = to.getTime() - from.getTime();
    const trousMs = gaps.reduce(
      (s, t) => s + (t.to.getTime() - t.from.getTime()),
      0,
    );
    const heures = (ms: number) => Math.round((ms / HEURE_MS) * 10) / 10;
    return {
      packageId,
      packageTitle: forfait.title,
      from,
      to,
      totalHours: heures(totalMs),
      coveredHours: heures(totalMs - trousMs),
      gaps,
    };
  }

  /** Qui appeler maintenant, pour le pèlerin titulaire de la réservation. */
  async getForBooking(
    pilgrimId: string,
    bookingId: string,
  ): Promise<MyOnCallShape> {
    const reservation = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        pilgrimId: true,
        agencyId: true,
        packageId: true,
        status: true,
        agency: { select: { legalName: true, contactPhone: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable');
    if (reservation.pilgrimId !== pilgrimId) {
      throw new ForbiddenException("Cette réservation n'est pas la vôtre");
    }
    if (reservation.status === CANCELLED) {
      throw new BadRequestException('Cette réservation est annulée');
    }
    const maintenant = new Date();
    const creneaux = await this.prisma.onCallShift.findMany({
      where: {
        agencyId: reservation.agencyId,
        OR: [{ packageId: reservation.packageId }, { packageId: null }],
        endsAt: { gt: maintenant },
      },
      orderBy: { startsAt: 'asc' },
      take: 20,
    });
    const enCours = creneaux.filter((c) => c.startsAt <= maintenant);
    const suivant = creneaux.find((c) => c.startsAt > maintenant);
    return {
      bookingId: reservation.id,
      agencyName: reservation.agency.legalName,
      agencyPhone: reservation.agency.contactPhone,
      current: enCours.map(toContactShape),
      next: suivant ? toContactShape(suivant) : undefined,
    };
  }

  private async agencyIdOf(ownerId: string): Promise<string> {
    return (await this.agenciesService.findByOwnerOrFail(ownerId)).id;
  }

  private async assertOwnPackage(
    agencyId: string,
    packageId: string,
  ): Promise<{ title: string; startDate: Date; endDate: Date }> {
    const forfait = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { agencyId: true, title: true, startDate: true, endDate: true },
    });
    if (!forfait) throw new NotFoundException('Forfait introuvable');
    if (forfait.agencyId !== agencyId) {
      throw new ForbiddenException(
        "Ce forfait n'appartient pas à votre agence",
      );
    }
    return forfait;
  }

  private async findOwnedOrFail(ownerId: string, id: string): Promise<Creneau> {
    const agencyId = await this.agencyIdOf(ownerId);
    const creneau = await this.prisma.onCallShift.findUnique({
      where: { id },
      include: AVEC_FORFAIT,
    });
    if (!creneau)
      throw new NotFoundException("Créneau d'astreinte introuvable");
    if (creneau.agencyId !== agencyId) {
      throw new ForbiddenException(
        "Ce créneau n'appartient pas à votre agence",
      );
    }
    return creneau;
  }
}
