import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: {
    group: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    groupMember: { create: jest.Mock };
    groupItineraryStep: { create: jest.Mock };
    groupMemberLocation: { upsert: jest.Mock; deleteMany: jest.Mock };
  };
  let agenciesService: { findByOwnerOrFail: jest.Mock };
  let usersService: { findByIdOrFail: jest.Mock };
  let notificationsService: { send: jest.Mock; sendRawSms: jest.Mock };

  const pilgrimId = 'pilgrim-1';
  const guideId = 'guide-1';
  const groupId = 'group-1';

  const buildGroup = (
    overrides: Partial<{
      guideId: string | null;
      members: { userId: string }[];
    }>,
  ) => ({
    id: groupId,
    packageId: 'package-1',
    agencyId: 'agency-1',
    title: 'Groupe A',
    guideId: null,
    members: [],
    itinerary: [],
    locations: [],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      group: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      groupMember: { create: jest.fn() },
      groupItineraryStep: { create: jest.fn() },
      groupMemberLocation: { upsert: jest.fn(), deleteMany: jest.fn() },
    };
    agenciesService = { findByOwnerOrFail: jest.fn() };
    usersService = { findByIdOrFail: jest.fn() };
    notificationsService = {
      send: jest.fn().mockResolvedValue(undefined),
      sendRawSms: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  describe('bouton SOS', () => {
    it("refuse le déclenchement si l'appelant ne fait pas partie du groupe", async () => {
      prisma.group.findUnique.mockResolvedValue(buildGroup({ members: [] }));

      await expect(
        service.triggerSos(pilgrimId, groupId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(notificationsService.send).not.toHaveBeenCalled();
    });

    it('alerte le guide (critique) et le contact famille par SMS quand le SOS est légitime', async () => {
      prisma.group.findUnique.mockResolvedValue(
        buildGroup({ members: [{ userId: pilgrimId }], guideId }),
      );
      usersService.findByIdOrFail.mockResolvedValue({
        fullName: 'Amadou Diallo',
        emergencyContact: {
          fullName: 'Fatoumata Diallo',
          phone: '+224620000099',
        },
      });

      await service.triggerSos(pilgrimId, groupId);

      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: [guideId],
          type: NotificationType.SOS,
          isCritical: true,
        }),
      );
      expect(notificationsService.sendRawSms).toHaveBeenCalledWith(
        '+224620000099',
        expect.stringContaining('Amadou Diallo'),
      );
    });

    it("n'envoie pas de SMS familial si aucun contact d'urgence n'est renseigné", async () => {
      prisma.group.findUnique.mockResolvedValue(
        buildGroup({ members: [{ userId: pilgrimId }] }),
      );
      usersService.findByIdOrFail.mockResolvedValue({
        fullName: 'Amadou Diallo',
        emergencyContact: undefined,
      });

      await service.triggerSos(pilgrimId, groupId);

      expect(notificationsService.send).not.toHaveBeenCalled();
      expect(notificationsService.sendRawSms).not.toHaveBeenCalled();
    });
  });

  describe('findAuthorizedOrFail', () => {
    it('autorise un membre du groupe', async () => {
      prisma.group.findUnique.mockResolvedValue(
        buildGroup({ members: [{ userId: pilgrimId }] }),
      );

      await expect(
        service.findAuthorizedOrFail(pilgrimId, Role.PILGRIM, groupId),
      ).resolves.toBeDefined();
    });

    it('joint le nom du membre à chaque position partagée, sans autre donnée personnelle', async () => {
      const updatedAt = new Date('2026-10-08T12:00:00.000Z');
      prisma.group.findUnique.mockResolvedValue({
        ...buildGroup({ members: [{ userId: pilgrimId }] }),
        locations: [
          {
            id: 'loc-1',
            groupId,
            userId: pilgrimId,
            lat: 21.4225,
            lng: 39.8262,
            updatedAt,
            user: { fullName: 'Pèlerin Factice' },
          },
        ],
      });

      const groupe = await service.findAuthorizedOrFail(
        pilgrimId,
        Role.PILGRIM,
        groupId,
      );

      expect(groupe.locations).toEqual([
        {
          userId: pilgrimId,
          fullName: 'Pèlerin Factice',
          lat: 21.4225,
          lng: 39.8262,
          updatedAt,
        },
      ]);
      // Seul le nom est lu sur l'utilisateur (requête Prisma).
      expect(prisma.group.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            locations: { include: { user: { select: { fullName: true } } } },
          }),
        }),
      );
    });

    it("refuse une agence qui n'est pas propriétaire du groupe", async () => {
      prisma.group.findUnique.mockResolvedValue(buildGroup({}));
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'other' });

      await expect(
        service.findAuthorizedOrFail('agency-owner', Role.AGENCY, groupId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assignGuide', () => {
    it("refuse d'assigner un utilisateur qui n'a pas le rôle guide", async () => {
      prisma.group.findUnique.mockResolvedValue(buildGroup({}));
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });
      usersService.findByIdOrFail.mockResolvedValue({
        id: pilgrimId,
        role: Role.PILGRIM,
      });

      await expect(
        service.assignGuide('owner-1', groupId, pilgrimId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.group.update).not.toHaveBeenCalled();
    });

    it('assigne le guide quand le rôle correspond', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce(buildGroup({}))
        .mockResolvedValueOnce(buildGroup({ guideId }));
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });
      usersService.findByIdOrFail.mockResolvedValue({
        id: guideId,
        role: Role.GUIDE,
        agencyId: 'agency-1',
      });
      prisma.group.update.mockResolvedValue(buildGroup({ guideId }));

      const result = await service.assignGuide('owner-1', groupId, guideId);

      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { guideId } }),
      );
      expect(result.guideId).toBe(guideId);
    });
  });

  it("refuse d'assigner le guide d'une autre agence", async () => {
    prisma.group.findUnique.mockResolvedValue(buildGroup({}));
    agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });
    usersService.findByIdOrFail.mockResolvedValue({
      id: guideId,
      role: Role.GUIDE,
      agencyId: 'autre-agence',
    });

    await expect(
      service.assignGuide('owner-1', groupId, guideId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  describe('addMember', () => {
    it('ajoute un pèlerin absent du groupe', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce(buildGroup({ members: [] }))
        .mockResolvedValueOnce(
          buildGroup({ members: [{ userId: pilgrimId }] }),
        );
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });

      await service.addMember('owner-1', groupId, pilgrimId);

      expect(prisma.groupMember.create).toHaveBeenCalledWith({
        data: { groupId, userId: pilgrimId },
      });
    });

    it('ne duplique pas un membre déjà présent', async () => {
      prisma.group.findUnique.mockResolvedValue(
        buildGroup({ members: [{ userId: pilgrimId }] }),
      );
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });

      await service.addMember('owner-1', groupId, pilgrimId);

      expect(prisma.groupMember.create).not.toHaveBeenCalled();
    });
  });

  describe('updateLocation', () => {
    it('refuse la mise à jour si le demandeur ne fait pas partie du groupe', async () => {
      prisma.group.findUnique.mockResolvedValue(buildGroup({}));

      await expect(
        service.updateLocation(pilgrimId, groupId, { lat: 21.4, lng: 39.8 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.groupMemberLocation.upsert).not.toHaveBeenCalled();
    });

    it('upsert la position pour un membre du groupe', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce(buildGroup({ members: [{ userId: pilgrimId }] }))
        .mockResolvedValueOnce(
          buildGroup({ members: [{ userId: pilgrimId }] }),
        );

      await service.updateLocation(pilgrimId, groupId, {
        lat: 21.4,
        lng: 39.8,
      });

      expect(prisma.groupMemberLocation.upsert).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId, userId: pilgrimId } },
        create: { groupId, userId: pilgrimId, lat: 21.4, lng: 39.8 },
        update: { lat: 21.4, lng: 39.8 },
      });
    });
  });

  describe('clearLocation', () => {
    it('efface seulement la position du demandeur dans ce groupe', async () => {
      await service.clearLocation(pilgrimId, groupId);

      expect(prisma.groupMemberLocation.deleteMany).toHaveBeenCalledWith({
        where: { groupId, userId: pilgrimId },
      });
    });
  });

  describe('triggerLostAlert', () => {
    it("refuse le déclenchement si l'appelant ne fait pas partie du groupe", async () => {
      prisma.group.findUnique.mockResolvedValue(buildGroup({ members: [] }));

      await expect(
        service.triggerLostAlert(pilgrimId, groupId, 21.42, 39.82),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.groupMemberLocation.upsert).not.toHaveBeenCalled();
      expect(notificationsService.send).not.toHaveBeenCalled();
    });

    it('met à jour la position et alerte le guide sans SMS', async () => {
      prisma.group.findUnique.mockResolvedValue(
        buildGroup({ members: [{ userId: pilgrimId }], guideId }),
      );
      usersService.findByIdOrFail.mockResolvedValue({
        fullName: 'Amadou Diallo',
      });

      await service.triggerLostAlert(pilgrimId, groupId, 21.42, 39.82);

      // Verify location was updated
      expect(prisma.groupMemberLocation.upsert).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId, userId: pilgrimId } },
        create: { groupId, userId: pilgrimId, lat: 21.42, lng: 39.82 },
        update: { lat: 21.42, lng: 39.82 },
      });

      // Verify guide was notified but not critical
      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: [guideId],
          type: NotificationType.OTHER,
          isCritical: false,
        }),
      );

      // Verify no SMS was sent
      expect(notificationsService.sendRawSms).not.toHaveBeenCalled();
    });
  });
});
