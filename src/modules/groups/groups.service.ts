import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { UsersService } from '../users/users.service';
import { AddItineraryStepDto } from './dto/add-itinerary-step.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Group, GroupDocument } from './schemas/group.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    private readonly agenciesService: AgenciesService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ownerId: string, dto: CreateGroupDto): Promise<GroupDocument> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    return this.groupModel.create({
      package: new Types.ObjectId(dto.packageId),
      agency: agency._id,
      title: dto.title,
    });
  }

  findByIdOrFail(id: string): Promise<GroupDocument> {
    return this.groupModel
      .findById(id)
      .exec()
      .then((group) => {
        if (!group) {
          throw new NotFoundException('Groupe introuvable');
        }
        return group;
      });
  }

  listByAgency(ownerId: string): Promise<GroupDocument[]> {
    return this.agenciesService
      .findByOwnerOrFail(ownerId)
      .then((agency) => this.groupModel.find({ agency: agency._id }).exec());
  }

  listForGuide(guideUserId: string): Promise<GroupDocument[]> {
    return this.groupModel
      .find({ guide: new Types.ObjectId(guideUserId) })
      .exec();
  }

  listForPilgrim(pilgrimUserId: string): Promise<GroupDocument[]> {
    return this.groupModel
      .find({ members: new Types.ObjectId(pilgrimUserId) })
      .exec();
  }

  // Le détail d'un groupe expose la position partagée des membres (données
  // sensibles, opt-in) : seuls les membres, le guide assigné, l'agence
  // propriétaire ou l'admin peuvent y accéder.
  async findAuthorizedOrFail(
    requesterId: string,
    requesterRole: Role,
    groupId: string,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrFail(groupId);

    if (requesterRole === Role.ADMIN) {
      return group;
    }

    const requesterObjectId = new Types.ObjectId(requesterId);
    if (
      group.members.some((m) => m.equals(requesterObjectId)) ||
      (group.guide?.equals(requesterObjectId) ?? false)
    ) {
      return group;
    }

    if (requesterRole === Role.AGENCY) {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (group.agency.equals(agency._id as Types.ObjectId)) {
        return group;
      }
    }

    throw new ForbiddenException("Vous n'avez pas accès à ce groupe");
  }

  async assignGuide(
    ownerId: string,
    groupId: string,
    guideUserId: string,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrFail(groupId);
    await this.assertAgencyOwnership(ownerId, group);

    const guide = await this.usersService.findByIdOrFail(guideUserId);
    if (guide.role !== Role.GUIDE) {
      throw new BadRequestException(
        "L'utilisateur désigné n'a pas le rôle guide",
      );
    }

    group.guide = guide._id as Types.ObjectId;
    return group.save();
  }

  async addMember(
    ownerId: string,
    groupId: string,
    pilgrimUserId: string,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrFail(groupId);
    await this.assertAgencyOwnership(ownerId, group);

    const memberId = new Types.ObjectId(pilgrimUserId);
    if (!group.members.some((m) => m.equals(memberId))) {
      group.members.push(memberId);
      await group.save();
    }
    return group;
  }

  async addItineraryStep(
    ownerId: string,
    groupId: string,
    dto: AddItineraryStepDto,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrFail(groupId);
    await this.assertAgencyOwnership(ownerId, group);
    group.itinerary.push({
      label: dto.label,
      date: new Date(dto.date),
      location: dto.location,
    });
    return group.save();
  }

  async updateLocation(
    userId: string,
    groupId: string,
    dto: UpdateLocationDto,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrFail(groupId);
    const userObjectId = new Types.ObjectId(userId);
    const isMember = group.members.some((m) => m.equals(userObjectId));
    const isGuide = group.guide?.equals(userObjectId) ?? false;
    if (!isMember && !isGuide) {
      throw new ForbiddenException('Vous ne faites pas partie de ce groupe');
    }

    const entry = {
      user: userObjectId,
      lat: dto.lat,
      lng: dto.lng,
      updatedAt: new Date(),
    };
    const existingIndex = group.locations.findIndex((l) =>
      l.user.equals(userObjectId),
    );
    if (existingIndex >= 0) {
      group.locations[existingIndex] = entry;
    } else {
      group.locations.push(entry);
    }
    return group.save();
  }

  // Bouton SOS — cahier des charges §3.1/§3.3 : alerte immédiate au guide et
  // au contact famille du pèlerin (voir ADR 0009 pour le canal SMS de secours).
  async triggerSos(pilgrimUserId: string, groupId: string): Promise<void> {
    const group = await this.findByIdOrFail(groupId);
    const userObjectId = new Types.ObjectId(pilgrimUserId);
    if (!group.members.some((m) => m.equals(userObjectId))) {
      throw new ForbiddenException('Vous ne faites pas partie de ce groupe');
    }

    const pilgrim = await this.usersService.findByIdOrFail(pilgrimUserId);

    if (group.guide) {
      await this.notificationsService.send({
        recipientIds: [group.guide.toString()],
        type: NotificationType.SOS,
        title: 'Alerte SOS',
        content: `${pilgrim.fullName} a déclenché une alerte SOS dans le groupe "${group.title}".`,
        isCritical: true,
      });
    }

    if (pilgrim.emergencyContact?.phone) {
      await this.notificationsService.sendRawSms(
        pilgrim.emergencyContact.phone,
        `Alerte SOS : ${pilgrim.fullName} a déclenché une alerte d'urgence pendant son voyage.`,
      );
    }
  }

  private async assertAgencyOwnership(
    ownerId: string,
    group: GroupDocument,
  ): Promise<void> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (!group.agency.equals(agency._id as Types.ObjectId)) {
      throw new ForbiddenException("Ce groupe n'appartient pas à votre agence");
    }
  }
}
