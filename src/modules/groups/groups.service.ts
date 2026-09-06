import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Group as PrismaGroup,
  GroupItineraryStep as PrismaGroupItineraryStep,
  GroupMember as PrismaGroupMember,
  GroupMemberLocation as PrismaGroupMemberLocation,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';
import { GroupShape } from '../../types/group.types';
import { AgenciesService } from '../agencies/agencies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { UsersService } from '../users/users.service';
import { AddItineraryStepDto } from './dto/add-itinerary-step.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

const GROUP_INCLUDE = {
  members: true,
  itinerary: true,
  locations: true,
} as const;

type GroupRecord = PrismaGroup & {
  members: PrismaGroupMember[];
  itinerary: PrismaGroupItineraryStep[];
  locations: PrismaGroupMemberLocation[];
};

function toGroupShape(group: GroupRecord): GroupShape {
  return {
    id: group.id,
    packageId: group.packageId,
    agencyId: group.agencyId,
    title: group.title,
    guideId: group.guideId ?? undefined,
    memberIds: group.members.map((member) => member.userId),
    itinerary: group.itinerary.map((step) => ({
      label: step.label,
      date: step.date,
      location: step.location ?? undefined,
    })),
    locations: group.locations.map((location) => ({
      userId: location.userId,
      lat: location.lat,
      lng: location.lng,
      updatedAt: location.updatedAt,
    })),
  };
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ownerId: string, dto: CreateGroupDto): Promise<GroupShape> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const group = await this.prisma.group.create({
      data: {
        packageId: dto.packageId,
        agencyId: agency.id,
        title: dto.title,
      },
      include: GROUP_INCLUDE,
    });
    return toGroupShape(group);
  }

  async findByIdOrFail(id: string): Promise<GroupShape> {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: GROUP_INCLUDE,
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    return toGroupShape(group);
  }

  async listByAgency(ownerId: string): Promise<GroupShape[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const groups = await this.prisma.group.findMany({
      where: { agencyId: agency.id },
      include: GROUP_INCLUDE,
    });
    return groups.map(toGroupShape);
  }

  async listForGuide(guideUserId: string): Promise<GroupShape[]> {
    const groups = await this.prisma.group.findMany({
      where: { guideId: guideUserId },
      include: GROUP_INCLUDE,
    });
    return groups.map(toGroupShape);
  }

  async listForPilgrim(pilgrimUserId: string): Promise<GroupShape[]> {
    const groups = await this.prisma.group.findMany({
      where: { members: { some: { userId: pilgrimUserId } } },
      include: GROUP_INCLUDE,
    });
    return groups.map(toGroupShape);
  }

  // Le détail d'un groupe expose la position partagée des membres (données
  // sensibles, opt-in) : seuls les membres, le guide assigné, l'agence
  // propriétaire ou l'admin peuvent y accéder.
  async findAuthorizedOrFail(
    requesterId: string,
    requesterRole: Role,
    groupId: string,
  ): Promise<GroupShape> {
    const group = await this.findByIdOrFail(groupId);

    if (requesterRole === Role.ADMIN) {
      return group;
    }

    if (
      group.memberIds.includes(requesterId) ||
      group.guideId === requesterId
    ) {
      return group;
    }

    if (requesterRole === Role.AGENCY) {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (group.agencyId === agency.id) {
        return group;
      }
    }

    throw new ForbiddenException("Vous n'avez pas accès à ce groupe");
  }

  async assignGuide(
    ownerId: string,
    groupId: string,
    guideUserId: string,
  ): Promise<GroupShape> {
    const group = await this.findByIdOrFail(groupId);
    await this.assertAgencyOwnership(ownerId, group);

    const guide = await this.usersService.findByIdOrFail(guideUserId);
    if (guide.role !== Role.GUIDE) {
      throw new BadRequestException(
        "L'utilisateur désigné n'a pas le rôle guide",
      );
    }

    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { guideId: guide.id },
      include: GROUP_INCLUDE,
    });
    return toGroupShape(updated);
  }

  async addMember(
    ownerId: string,
    groupId: string,
    pilgrimUserId: string,
  ): Promise<GroupShape> {
    const group = await this.findByIdOrFail(groupId);
    await this.assertAgencyOwnership(ownerId, group);

    if (!group.memberIds.includes(pilgrimUserId)) {
      await this.prisma.groupMember.create({
        data: { groupId: group.id, userId: pilgrimUserId },
      });
    }
    return this.findByIdOrFail(groupId);
  }

  async addItineraryStep(
    ownerId: string,
    groupId: string,
    dto: AddItineraryStepDto,
  ): Promise<GroupShape> {
    const group = await this.findByIdOrFail(groupId);
    await this.assertAgencyOwnership(ownerId, group);

    await this.prisma.groupItineraryStep.create({
      data: {
        groupId: group.id,
        label: dto.label,
        date: new Date(dto.date),
        location: dto.location,
      },
    });
    return this.findByIdOrFail(groupId);
  }

  async updateLocation(
    userId: string,
    groupId: string,
    dto: UpdateLocationDto,
  ): Promise<GroupShape> {
    const group = await this.findByIdOrFail(groupId);
    const isMember = group.memberIds.includes(userId);
    const isGuide = group.guideId === userId;
    if (!isMember && !isGuide) {
      throw new ForbiddenException('Vous ne faites pas partie de ce groupe');
    }

    await this.prisma.groupMemberLocation.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId, lat: dto.lat, lng: dto.lng },
      update: { lat: dto.lat, lng: dto.lng },
    });
    return this.findByIdOrFail(groupId);
  }

  // Bouton SOS — cahier des charges §3.1/§3.3 : alerte immédiate au guide et
  // au contact famille du pèlerin (voir ADR 0009 pour le canal SMS de secours).
  async triggerSos(pilgrimUserId: string, groupId: string): Promise<void> {
    const group = await this.findByIdOrFail(groupId);
    if (!group.memberIds.includes(pilgrimUserId)) {
      throw new ForbiddenException('Vous ne faites pas partie de ce groupe');
    }

    const pilgrim = await this.usersService.findByIdOrFail(pilgrimUserId);

    if (group.guideId) {
      await this.notificationsService.send({
        recipientIds: [group.guideId],
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
    group: GroupShape,
  ): Promise<void> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (group.agencyId !== agency.id) {
      throw new ForbiddenException("Ce groupe n'appartient pas à votre agence");
    }
  }
}
