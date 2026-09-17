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
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../../common/enums/dossier-step-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { Role } from '../../common/enums/role.enum';
import {
  BookingShape,
  FamilyViewLinkShape,
  FamilyViewShape,
} from '../../types/booking.types';
import { AgenciesService } from '../agencies/agencies.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackagesService } from '../packages/packages.service';
import { UsersService } from '../users/users.service';
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

// Libellés lisibles pour les notifications d'étape — cahier des charges
// §3.1 ("Notifications d'étapes : dossier validé...").
const STEP_LABELS: Record<DossierStepKey, string> = {
  [DossierStepKey.PAYMENT]: 'Paiement',
  [DossierStepKey.VISA]: 'Visa',
  [DossierStepKey.FLIGHT]: "Billet d'avion",
  [DossierStepKey.VACCINATION]: 'Vaccination',
  [DossierStepKey.DOCUMENTS]: 'Documents',
};

type BookingRecord = PrismaBooking & { steps: PrismaBookingStep[] };

// Chemin en dur comme AgenciesService.toCalendarSubscriptionShape (idée
// #70) — le client compose avec sa propre base.
function toFamilyViewLinkShape(token: string): FamilyViewLinkShape {
  return { token, viewUrl: `/api/v1/family-view/${token}` };
}

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
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
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

    const updated = await this.maybeConfirm(booking.id);
    if (dto.status === DossierStepStatus.DONE) {
      await this.notifyStepDone(updated, dto.key);
    }
    return updated;
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
    const updated = await this.maybeConfirm(bookingId);
    await this.notifyStepDone(updated, key);
    return updated;
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

  // Idée #28 (backlog "Cent Fonctionnalités") — espace famille simplifié :
  // un lien de suivi en lecture seule, sans compte pèlerin à créer pour un
  // proche peu digitalisé. Seul le pèlerin propriétaire de la réservation
  // peut générer ce lien — c'est un choix de partage personnel, pas une
  // action que l'agence peut faire à sa place.
  async getOrCreateFamilyViewLink(
    pilgrimId: string,
    bookingId: string,
  ): Promise<FamilyViewLinkShape> {
    const booking = await this.findByIdOrFail(bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    const raw = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    if (raw.familyViewToken) {
      return toFamilyViewLinkShape(raw.familyViewToken);
    }
    return this.regenerateFamilyViewLink(pilgrimId, bookingId);
  }

  // Révoque l'ancien lien (si partagé au-delà de la famille voulue) en le
  // remplaçant par un nouveau.
  async regenerateFamilyViewLink(
    pilgrimId: string,
    bookingId: string,
  ): Promise<FamilyViewLinkShape> {
    const booking = await this.findByIdOrFail(bookingId);
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    const token = randomBytes(24).toString('hex');
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { familyViewToken: token },
    });
    return toFamilyViewLinkShape(token);
  }

  // Vue publique, sans authentification — le jeton fait office
  // d'autorisation (même principe que le calendrier agence, idée #70).
  // N'expose jamais les documents ni les paiements.
  async getFamilyView(token: string): Promise<FamilyViewShape> {
    const raw = await this.prisma.booking.findUnique({
      where: { familyViewToken: token },
      include: BOOKING_INCLUDE,
    });
    if (!raw) {
      throw new NotFoundException('Lien de suivi invalide');
    }
    const booking = toBookingShape(raw);

    const [pkg, pilgrim, group] = await Promise.all([
      this.packagesService.findByIdOrFail(booking.packageId),
      this.usersService.findByIdOrFail(booking.pilgrimId),
      booking.groupId
        ? this.groupsService.findByIdOrFail(booking.groupId)
        : Promise.resolve(undefined),
    ]);

    const myLocation = group?.locations.find(
      (location) => location.userId === booking.pilgrimId,
    );
    const latestItineraryStep = group?.itinerary.length
      ? [...group.itinerary].sort(
          (a, b) => b.date.getTime() - a.date.getTime(),
        )[0]
      : undefined;

    return {
      pilgrimFullName: pilgrim.fullName,
      packageTitle: pkg.title,
      status: booking.status,
      steps: booking.steps,
      location: myLocation
        ? {
            lat: myLocation.lat,
            lng: myLocation.lng,
            updatedAt: myLocation.updatedAt,
          }
        : undefined,
      latestItineraryStep,
    };
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
    const allDone = booking.steps.every(
      (s) => s.status === DossierStepStatus.DONE,
    );
    // `!== CONFIRMED` : ne notifie que sur une vraie transition, pas à
    // chaque appel une fois le dossier déjà confirmé (ex. une étape
    // revalidée après coup).
    if (allDone && booking.status !== BookingStatus.CONFIRMED) {
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED as unknown as PrismaBookingStatus,
        },
        include: BOOKING_INCLUDE,
      });
      const shape = toBookingShape(updated);
      await this.notifyConfirmed(shape);
      return shape;
    }
    return booking;
  }

  // Cahier des charges §3.1 ("Notifications d'étapes : dossier validé...").
  private async notifyStepDone(
    booking: BookingShape,
    key: DossierStepKey,
  ): Promise<void> {
    await this.notifyPilgrimAndFamily(
      booking.pilgrimId,
      `Étape « ${STEP_LABELS[key]} » validée`,
      `L'étape « ${STEP_LABELS[key]} » de votre dossier vient d'être validée.`,
      false,
    );
  }

  private async notifyConfirmed(booking: BookingShape): Promise<void> {
    await this.notifyPilgrimAndFamily(
      booking.pilgrimId,
      'Dossier confirmé',
      'Toutes les étapes de votre dossier sont validées — votre réservation est confirmée.',
      true,
    );
  }

  // Idée #29 (backlog "Cent Fonctionnalités") : notifie aussi le contact
  // d'urgence par SMS direct, même pattern que le SOS
  // (voir GroupsService.triggerSos) — la famille restée au pays n'a
  // aujourd'hui aucun autre moyen fiable de suivre le dossier (cahier des
  // charges §1.2).
  private async notifyPilgrimAndFamily(
    pilgrimId: string,
    title: string,
    content: string,
    isCritical: boolean,
  ): Promise<void> {
    await this.notificationsService.send({
      recipientIds: [pilgrimId],
      type: NotificationType.BOOKING_STATUS,
      title,
      content,
      isCritical,
    });

    const pilgrim = await this.usersService.findByIdOrFail(pilgrimId);
    if (pilgrim.emergencyContact?.phone) {
      await this.notificationsService.sendRawSms(
        pilgrim.emergencyContact.phone,
        `${pilgrim.fullName} — ${content}`,
      );
    }
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
