import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Booking as PrismaBooking,
  BookingStatus as PrismaBookingStatus,
  BookingStep as PrismaBookingStep,
  DossierStepKey as PrismaDossierStepKey,
  DossierStepStatus as PrismaDossierStepStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../../common/enums/dossier-step-status.enum';
import { Role } from '../../common/enums/role.enum';
import { BookingShape } from '../../types/booking.types';
import { AgenciesService } from '../agencies/agencies.service';
import { GroupsService } from '../groups/groups.service';
import { PackagesService } from '../packages/packages.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStepDto } from './dto/update-step.dto';

const BOOKING_INCLUDE = { steps: true } as const;

const DEFAULT_STEPS: DossierStepKey[] = [
  DossierStepKey.PAYMENT,
  DossierStepKey.VISA,
  DossierStepKey.FLIGHT,
  DossierStepKey.VACCINATION,
  DossierStepKey.DOCUMENTS,
];

type BookingRecord = PrismaBooking & { steps: PrismaBookingStep[] };

function toBookingShape(booking: BookingRecord): BookingShape {
  return {
    id: booking.id,
    pilgrimId: booking.pilgrimId,
    packageId: booking.packageId,
    agencyId: booking.agencyId,
    groupId: booking.groupId ?? undefined,
    status: booking.status as unknown as BookingStatus,
    steps: booking.steps.map((step) => ({
      key: step.key as unknown as DossierStepKey,
      status: step.status as unknown as DossierStepStatus,
      updatedAt: step.updatedAt,
    })),
  };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesService: PackagesService,
    private readonly agenciesService: AgenciesService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(
    pilgrimId: string,
    dto: CreateBookingDto,
  ): Promise<BookingShape> {
    const pkg = await this.packagesService.findByIdOrFail(dto.packageId);
    await this.packagesService.reserveSeat(dto.packageId);

    const booking = await this.prisma.booking.create({
      data: {
        pilgrimId,
        packageId: pkg.id,
        agencyId: pkg.agencyId,
        steps: {
          create: DEFAULT_STEPS.map((key) => ({
            key: key as unknown as PrismaDossierStepKey,
            status:
              DossierStepStatus.PENDING as unknown as PrismaDossierStepStatus,
          })),
        },
      },
      include: BOOKING_INCLUDE,
    });
    return toBookingShape(booking);
  }

  async findByIdOrFail(id: string): Promise<BookingShape> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Réservation introuvable');
    }
    return toBookingShape(booking);
  }

  async findMine(pilgrimId: string): Promise<BookingShape[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { pilgrimId },
      include: BOOKING_INCLUDE,
    });
    return bookings.map(toBookingShape);
  }

  async findByAgency(ownerId: string): Promise<BookingShape[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const bookings = await this.prisma.booking.findMany({
      where: { agencyId: agency.id },
      include: BOOKING_INCLUDE,
    });
    return bookings.map(toBookingShape);
  }

  // Score de confiance agence (idée #96 du backlog "Cent Fonctionnalités") —
  // agencyId direct, pas ownerId : appelé par ReviewsService, qui ne connaît
  // que l'agence publique, jamais son propriétaire.
  async countByAgencyAndStatus(
    agencyId: string,
  ): Promise<Record<BookingStatus, number>> {
    const statuses = Object.values(BookingStatus);
    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.booking.count({
          where: { agencyId, status: status as unknown as PrismaBookingStatus },
        }),
      ),
    );
    return Object.fromEntries(
      statuses.map((status, i) => [status, counts[i]]),
    ) as Record<BookingStatus, number>;
  }

  async findAuthorizedOrFail(
    requesterId: string,
    requesterRole: Role,
    bookingId: string,
  ): Promise<BookingShape> {
    const booking = await this.findByIdOrFail(bookingId);

    if (requesterRole === Role.ADMIN || booking.pilgrimId === requesterId) {
      return booking;
    }

    if (requesterRole === Role.AGENCY) {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (booking.agencyId === agency.id) {
        return booking;
      }
    }

    throw new ForbiddenException("Vous n'avez pas accès à cette réservation");
  }

  async updateStep(
    ownerId: string,
    bookingId: string,
    dto: UpdateStepDto,
  ): Promise<BookingShape> {
    const booking = await this.findByIdOrFail(bookingId);
    await this.assertAgencyOwnership(ownerId, booking);

    await this.prisma.bookingStep
      .update({
        where: {
          bookingId_key: {
            bookingId: booking.id,
            key: dto.key as unknown as PrismaDossierStepKey,
          },
        },
        data: { status: dto.status as unknown as PrismaDossierStepStatus },
      })
      .catch(() => {
        throw new NotFoundException('Étape de dossier introuvable');
      });

    return this.maybeConfirm(booking.id);
  }

  // Appelé par le module payments lorsqu'une tranche solde le forfait.
  async markStepDone(
    bookingId: string,
    key: DossierStepKey,
  ): Promise<BookingShape> {
    await this.prisma.bookingStep.update({
      where: {
        bookingId_key: {
          bookingId,
          key: key as unknown as PrismaDossierStepKey,
        },
      },
      data: {
        status: DossierStepStatus.DONE as unknown as PrismaDossierStepStatus,
      },
    });
    return this.maybeConfirm(bookingId);
  }

  async assignGroup(
    ownerId: string,
    bookingId: string,
    groupId: string,
  ): Promise<BookingShape> {
    const booking = await this.findByIdOrFail(bookingId);
    await this.assertAgencyOwnership(ownerId, booking);

    await this.groupsService.addMember(ownerId, groupId, booking.pilgrimId);

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { groupId },
      include: BOOKING_INCLUDE,
    });
    return toBookingShape(updated);
  }

  async cancel(pilgrimId: string, bookingId: string): Promise<BookingShape> {
    const booking = await this.findByIdOrFail(bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (booking.status !== BookingStatus.CANCELLED) {
      await this.packagesService.releaseSeat(booking.packageId);
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED as unknown as PrismaBookingStatus,
      },
      include: BOOKING_INCLUDE,
    });
    return toBookingShape(updated);
  }

  // Statistiques globales admin — cahier des charges §3.4.
  async countByStatus(): Promise<Record<BookingStatus, number>> {
    const statuses = Object.values(BookingStatus);
    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.booking.count({
          where: { status: status as unknown as PrismaBookingStatus },
        }),
      ),
    );
    return Object.fromEntries(
      statuses.map((status, i) => [status, counts[i]]),
    ) as Record<BookingStatus, number>;
  }

  private async maybeConfirm(bookingId: string): Promise<BookingShape> {
    const booking = await this.findByIdOrFail(bookingId);
    if (booking.steps.every((s) => s.status === DossierStepStatus.DONE)) {
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED as unknown as PrismaBookingStatus,
        },
        include: BOOKING_INCLUDE,
      });
      return toBookingShape(updated);
    }
    return booking;
  }

  private async assertAgencyOwnership(
    ownerId: string,
    booking: BookingShape,
  ): Promise<void> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (booking.agencyId !== agency.id) {
      throw new ForbiddenException(
        "Cette réservation n'appartient pas à votre agence",
      );
    }
  }
}
