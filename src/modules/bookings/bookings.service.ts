import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { GroupsService } from '../groups/groups.service';
import { PackagesService } from '../packages/packages.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import {
  Booking,
  BookingDocument,
  BookingStatus,
  DossierStepKey,
  DossierStepStatus,
} from './schemas/booking.schema';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly packagesService: PackagesService,
    private readonly agenciesService: AgenciesService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(
    pilgrimId: string,
    dto: CreateBookingDto,
  ): Promise<BookingDocument> {
    const pkg = await this.packagesService.findByIdOrFail(dto.packageId);
    await this.packagesService.reserveSeat(dto.packageId);

    return this.bookingModel.create({
      pilgrim: new Types.ObjectId(pilgrimId),
      package: pkg._id,
      agency: pkg.agency,
    });
  }

  findByIdOrFail(id: string): Promise<BookingDocument> {
    return this.bookingModel
      .findById(id)
      .exec()
      .then((booking) => {
        if (!booking) {
          throw new NotFoundException('Réservation introuvable');
        }
        return booking;
      });
  }

  findMine(pilgrimId: string): Promise<BookingDocument[]> {
    return this.bookingModel
      .find({ pilgrim: new Types.ObjectId(pilgrimId) })
      .exec();
  }

  async findByAgency(ownerId: string): Promise<BookingDocument[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    return this.bookingModel.find({ agency: agency._id }).exec();
  }

  async findAuthorizedOrFail(
    requesterId: string,
    requesterRole: Role,
    bookingId: string,
  ): Promise<BookingDocument> {
    const booking = await this.findByIdOrFail(bookingId);

    if (
      requesterRole === Role.ADMIN ||
      booking.pilgrim.toString() === requesterId
    ) {
      return booking;
    }

    if (requesterRole === Role.AGENCY) {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (booking.agency.equals(agency._id as Types.ObjectId)) {
        return booking;
      }
    }

    throw new ForbiddenException("Vous n'avez pas accès à cette réservation");
  }

  async updateStep(
    ownerId: string,
    bookingId: string,
    dto: UpdateStepDto,
  ): Promise<BookingDocument> {
    const booking = await this.findByIdOrFail(bookingId);
    await this.assertAgencyOwnership(ownerId, booking);

    const step = booking.steps.find((s) => s.key === dto.key);
    if (!step) {
      throw new NotFoundException('Étape de dossier introuvable');
    }
    step.status = dto.status;
    step.updatedAt = new Date();

    if (booking.steps.every((s) => s.status === DossierStepStatus.DONE)) {
      booking.status = BookingStatus.CONFIRMED;
    }

    return booking.save();
  }

  // Appelé par le module payments lorsqu'une tranche solde le forfait.
  async markStepDone(
    bookingId: string,
    key: DossierStepKey,
  ): Promise<BookingDocument> {
    const booking = await this.findByIdOrFail(bookingId);
    const step = booking.steps.find((s) => s.key === key);
    if (step) {
      step.status = DossierStepStatus.DONE;
      step.updatedAt = new Date();
    }
    if (booking.steps.every((s) => s.status === DossierStepStatus.DONE)) {
      booking.status = BookingStatus.CONFIRMED;
    }
    return booking.save();
  }

  async assignGroup(
    ownerId: string,
    bookingId: string,
    groupId: string,
  ): Promise<BookingDocument> {
    const booking = await this.findByIdOrFail(bookingId);
    await this.assertAgencyOwnership(ownerId, booking);

    await this.groupsService.addMember(
      ownerId,
      groupId,
      booking.pilgrim.toString(),
    );
    booking.group = new Types.ObjectId(groupId);
    return booking.save();
  }

  async cancel(pilgrimId: string, bookingId: string): Promise<BookingDocument> {
    const booking = await this.findByIdOrFail(bookingId);
    if (booking.pilgrim.toString() !== pilgrimId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (booking.status !== BookingStatus.CANCELLED) {
      await this.packagesService.releaseSeat(booking.package.toString());
    }
    booking.status = BookingStatus.CANCELLED;
    return booking.save();
  }

  // Statistiques globales admin — cahier des charges §3.4.
  async countByStatus(): Promise<Record<BookingStatus, number>> {
    const counts = await this.bookingModel.aggregate<{
      _id: BookingStatus;
      count: number;
    }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const result = Object.fromEntries(
      Object.values(BookingStatus).map((status) => [status, 0]),
    ) as Record<BookingStatus, number>;
    for (const { _id, count } of counts) {
      result[_id] = count;
    }
    return result;
  }

  private async assertAgencyOwnership(
    ownerId: string,
    booking: BookingDocument,
  ): Promise<void> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (!booking.agency.equals(agency._id as Types.ObjectId)) {
      throw new ForbiddenException(
        "Cette réservation n'appartient pas à votre agence",
      );
    }
  }
}
