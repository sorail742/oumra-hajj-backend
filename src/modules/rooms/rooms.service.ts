import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus as PrismaBookingStatus, Prisma } from '@prisma/client';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { BOM_UTF8, celluleCsv } from '../../common/utils/csv';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MyRoomShape,
  ROOM_CAPACITY,
  RoomBlockShape,
  RoomOccupantShape,
  RoomType,
} from '../../types/room.types';
import { AgenciesService } from '../agencies/agencies.service';
import { AssignRoomDto } from './dto/assign-room.dto';
import { CreateRoomBlockDto } from './dto/create-room-block.dto';
import { UpdateRoomBlockDto } from './dto/update-room-block.dto';

const CANCELLED = BookingStatus.CANCELLED as unknown as PrismaBookingStatus;

const AVEC_OCCUPANTS = {
  package: { select: { title: true } },
  assignments: {
    orderBy: { createdAt: 'asc' },
    include: {
      booking: {
        select: { id: true, pilgrim: { select: { fullName: true } } },
      },
    },
  },
} satisfies Prisma.RoomBlockInclude;

type BlocComplet = Prisma.RoomBlockGetPayload<{
  include: typeof AVEC_OCCUPANTS;
}>;

const LIBELLE_TYPE: Record<RoomType, string> = {
  double: 'Double',
  triple: 'Triple',
  quadruple: 'Quadruple',
  quintuple: 'Quintuple',
};

function capacite(type: string): number {
  return ROOM_CAPACITY[type as RoomType];
}

function toRoomBlockShape(
  bloc: BlocComplet,
  reservationsDuForfait: RoomOccupantShape[],
): RoomBlockShape {
  const occupants = bloc.assignments.map((a) => ({
    roomNumber: a.roomNumber,
    bookingId: a.booking.id,
    pilgrimName: a.booking.pilgrim.fullName,
  }));
  const placees = new Set(occupants.map((o) => o.bookingId));
  const bedsPerRoom = capacite(bloc.roomType);
  return {
    id: bloc.id,
    packageId: bloc.packageId,
    packageTitle: bloc.package.title,
    stageId: bloc.stageId ?? undefined,
    hotelName: bloc.hotelName,
    city: bloc.city,
    roomType: bloc.roomType as RoomType,
    roomCount: bloc.roomCount,
    bedsPerRoom,
    totalBeds: bloc.roomCount * bedsPerRoom,
    assignedBeds: occupants.length,
    releaseDate: bloc.releaseDate ?? undefined,
    notes: bloc.notes ?? undefined,
    rooms: Array.from({ length: bloc.roomCount }, (_, i) => ({
      number: i + 1,
      occupants: occupants
        .filter((o) => o.roomNumber === i + 1)
        .map(({ bookingId, pilgrimName }) => ({ bookingId, pilgrimName })),
    })),
    unassigned: reservationsDuForfait.filter((r) => !placees.has(r.bookingId)),
  };
}

// Idée #40 (backlog "Cent Fonctionnalités") — allotement : l'agence
// déclare les blocs de chambres réservés auprès des hôtels pour un
// forfait, puis y place ses pèlerins au fil des ventes. La capacité d'une
// chambre découle de son type ; une place attribuée l'est sous verrou du
// bloc, pour que deux attributions simultanées ne surchargent pas une
// chambre.
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async listBlocks(
    ownerId: string,
    packageId?: string,
  ): Promise<RoomBlockShape[]> {
    const agencyId = await this.agencyIdOf(ownerId);
    const blocs = await this.prisma.roomBlock.findMany({
      where: { agencyId, ...(packageId && { packageId }) },
      include: AVEC_OCCUPANTS,
      orderBy: [{ createdAt: 'asc' }],
    });
    const reservations = await this.reservationsActives(
      agencyId,
      blocs.map((b) => b.packageId),
    );
    return blocs.map((b) =>
      toRoomBlockShape(b, reservations.get(b.packageId) ?? []),
    );
  }

  async createBlock(
    ownerId: string,
    dto: CreateRoomBlockDto,
  ): Promise<RoomBlockShape> {
    const agencyId = await this.agencyIdOf(ownerId);
    const forfait = await this.prisma.package.findUnique({
      where: { id: dto.packageId },
      include: { stages: true },
    });
    if (!forfait) throw new NotFoundException('Forfait introuvable');
    if (forfait.agencyId !== agencyId) {
      throw new ForbiddenException(
        "Ce forfait n'appartient pas à votre agence",
      );
    }
    const etape = dto.stageId
      ? forfait.stages.find((s) => s.id === dto.stageId)
      : undefined;
    if (dto.stageId && !etape) {
      throw new BadRequestException("Cette étape n'appartient pas au forfait");
    }
    const hotelName = dto.hotelName ?? etape?.hotelName;
    const city = dto.city ?? etape?.city;
    if (!hotelName || !city) {
      throw new BadRequestException(
        "Indiquez l'hôtel et la ville, ou choisissez une étape du forfait",
      );
    }
    const bloc = await this.prisma.roomBlock.create({
      data: {
        agencyId,
        packageId: forfait.id,
        stageId: etape?.id,
        hotelName,
        city,
        roomType: dto.roomType,
        roomCount: dto.roomCount,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
        notes: dto.notes,
      },
    });
    return this.getBlock(ownerId, bloc.id);
  }

  async getBlock(ownerId: string, id: string): Promise<RoomBlockShape> {
    const bloc = await this.findOwnedOrFail(ownerId, id);
    const reservations = await this.reservationsActives(bloc.agencyId, [
      bloc.packageId,
    ]);
    return toRoomBlockShape(bloc, reservations.get(bloc.packageId) ?? []);
  }

  async updateBlock(
    ownerId: string,
    id: string,
    dto: UpdateRoomBlockDto,
  ): Promise<RoomBlockShape> {
    const bloc = await this.findOwnedOrFail(ownerId, id);
    const derniereOccupee = Math.max(
      0,
      ...bloc.assignments.map((a) => a.roomNumber),
    );
    if (dto.roomCount !== undefined && dto.roomCount < derniereOccupee) {
      throw new ConflictException(
        `La chambre ${derniereOccupee} est occupée : libérez-la avant de réduire le bloc`,
      );
    }
    await this.prisma.roomBlock.update({
      where: { id },
      data: {
        ...dto,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
      },
    });
    return this.getBlock(ownerId, id);
  }

  async deleteBlock(ownerId: string, id: string): Promise<void> {
    const bloc = await this.findOwnedOrFail(ownerId, id);
    if (bloc.assignments.length > 0) {
      throw new ConflictException(
        'Des pèlerins sont placés dans ce bloc : retirez-les avant de le supprimer',
      );
    }
    await this.prisma.roomBlock.delete({ where: { id } });
  }

  async assign(
    ownerId: string,
    blockId: string,
    dto: AssignRoomDto,
  ): Promise<RoomBlockShape> {
    const bloc = await this.findOwnedOrFail(ownerId, blockId);
    const reservation = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (
      !reservation ||
      reservation.agencyId !== bloc.agencyId ||
      reservation.packageId !== bloc.packageId
    ) {
      throw new BadRequestException(
        'Cette réservation ne fait pas partie du forfait de ce bloc',
      );
    }
    if (reservation.status === CANCELLED) {
      throw new ConflictException('Cette réservation est annulée');
    }

    const parPlace = capacite(bloc.roomType);
    await this.prisma.$transaction(async (tx) => {
      // Verrou du bloc : les occupations lues ci-dessous ne bougent plus
      // jusqu'à la fin de la transaction.
      await tx.$queryRaw`SELECT id FROM room_blocks WHERE id = ${blockId} FOR UPDATE`;
      const places = await tx.roomAssignment.findMany({
        where: { roomBlockId: blockId, NOT: { bookingId: dto.bookingId } },
        select: { roomNumber: true },
      });
      const occupation = (n: number) =>
        places.filter((p) => p.roomNumber === n).length;
      const chambre =
        dto.roomNumber ??
        Array.from({ length: bloc.roomCount }, (_, i) => i + 1).find(
          (n) => occupation(n) < parPlace,
        );
      if (chambre === undefined) {
        throw new ConflictException(
          'Toutes les chambres du bloc sont complètes',
        );
      }
      if (chambre > bloc.roomCount) {
        throw new BadRequestException(
          `Le bloc compte ${bloc.roomCount} chambre(s)`,
        );
      }
      if (occupation(chambre) >= parPlace) {
        throw new ConflictException(`La chambre ${chambre} est complète`);
      }
      await tx.roomAssignment.upsert({
        where: {
          roomBlockId_bookingId: {
            roomBlockId: blockId,
            bookingId: dto.bookingId,
          },
        },
        create: {
          roomBlockId: blockId,
          bookingId: dto.bookingId,
          roomNumber: chambre,
        },
        update: { roomNumber: chambre },
      });
    });
    return this.getBlock(ownerId, blockId);
  }

  async unassign(
    ownerId: string,
    blockId: string,
    bookingId: string,
  ): Promise<RoomBlockShape> {
    await this.findOwnedOrFail(ownerId, blockId);
    const { count } = await this.prisma.roomAssignment.deleteMany({
      where: { roomBlockId: blockId, bookingId },
    });
    if (count === 0) {
      throw new NotFoundException("Cette réservation n'est pas placée ici");
    }
    return this.getBlock(ownerId, blockId);
  }

  /** Rooming list à transmettre à l'hôtel : une ligne par place occupée. */
  async getRoomingListCsv(ownerId: string, blockId: string): Promise<string> {
    const bloc = await this.getBlock(ownerId, blockId);
    const entete = ['Hôtel', 'Ville', 'Type', 'Chambre', 'Pèlerin']
      .map(celluleCsv)
      .join(';');
    const lignes = bloc.rooms.flatMap((chambre) =>
      chambre.occupants.map((o) =>
        [
          bloc.hotelName,
          bloc.city,
          LIBELLE_TYPE[bloc.roomType],
          String(chambre.number),
          o.pilgrimName,
        ]
          .map(celluleCsv)
          .join(';'),
      ),
    );
    return `${BOM_UTF8}${[entete, ...lignes].join('\r\n')}`;
  }

  /** Chambres attribuées au pèlerin, sur ses réservations actives. */
  async findMine(pilgrimId: string): Promise<MyRoomShape[]> {
    const places = await this.prisma.roomAssignment.findMany({
      where: { booking: { pilgrimId, status: { not: CANCELLED } } },
      include: {
        roomBlock: {
          include: {
            package: { select: { title: true } },
            stage: { select: { startDate: true, endDate: true } },
          },
        },
      },
    });
    return places
      .map((p) => ({
        hotelName: p.roomBlock.hotelName,
        city: p.roomBlock.city,
        roomType: p.roomBlock.roomType as RoomType,
        roomNumber: p.roomNumber,
        packageTitle: p.roomBlock.package.title,
        startDate: p.roomBlock.stage?.startDate,
        endDate: p.roomBlock.stage?.endDate,
      }))
      .sort(
        (a, b) =>
          (a.startDate?.getTime() ?? Infinity) -
          (b.startDate?.getTime() ?? Infinity),
      );
  }

  private async agencyIdOf(ownerId: string): Promise<string> {
    return (await this.agenciesService.findByOwnerOrFail(ownerId)).id;
  }

  private async findOwnedOrFail(
    ownerId: string,
    id: string,
  ): Promise<BlocComplet> {
    const agencyId = await this.agencyIdOf(ownerId);
    const bloc = await this.prisma.roomBlock.findUnique({
      where: { id },
      include: AVEC_OCCUPANTS,
    });
    if (!bloc) throw new NotFoundException('Bloc de chambres introuvable');
    if (bloc.agencyId !== agencyId) {
      throw new ForbiddenException("Ce bloc n'appartient pas à votre agence");
    }
    return bloc;
  }

  /** Réservations non annulées de l'agence, par forfait. */
  private async reservationsActives(
    agencyId: string,
    packageIds: string[],
  ): Promise<Map<string, RoomOccupantShape[]>> {
    const parForfait = new Map<string, RoomOccupantShape[]>();
    if (packageIds.length === 0) return parForfait;
    const reservations = await this.prisma.booking.findMany({
      where: {
        agencyId,
        packageId: { in: [...new Set(packageIds)] },
        status: { not: CANCELLED },
      },
      select: {
        id: true,
        packageId: true,
        pilgrim: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const r of reservations) {
      const liste = parForfait.get(r.packageId) ?? [];
      liste.push({ bookingId: r.id, pilgrimName: r.pilgrim.fullName });
      parForfait.set(r.packageId, liste);
    }
    return parForfait;
  }
}
