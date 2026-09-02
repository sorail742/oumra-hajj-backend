import { ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AgenciesService } from '../agencies/agencies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { UsersService } from '../users/users.service';
import { GroupsService } from './groups.service';
import { Group } from './schemas/group.schema';

describe('GroupsService — bouton SOS', () => {
  let service: GroupsService;
  let groupModel: { findById: jest.Mock };
  let usersService: { findByIdOrFail: jest.Mock };
  let notificationsService: { send: jest.Mock; sendRawSms: jest.Mock };

  const pilgrimId = new Types.ObjectId().toString();
  const guideId = new Types.ObjectId().toString();
  const groupId = new Types.ObjectId().toString();

  beforeEach(async () => {
    groupModel = { findById: jest.fn() };
    usersService = { findByIdOrFail: jest.fn() };
    notificationsService = {
      send: jest.fn().mockResolvedValue(undefined),
      sendRawSms: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: getModelToken(Group.name), useValue: groupModel },
        { provide: AgenciesService, useValue: {} },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  it("refuse le déclenchement si l'appelant ne fait pas partie du groupe", async () => {
    groupModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        members: [],
        guide: undefined,
        title: 'Groupe A',
      }),
    });

    await expect(service.triggerSos(pilgrimId, groupId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(notificationsService.send).not.toHaveBeenCalled();
  });

  it('alerte le guide (critique) et le contact famille par SMS quand le SOS est légitime', async () => {
    const memberObjectId = new Types.ObjectId(pilgrimId);
    const guideObjectId = new Types.ObjectId(guideId);
    groupModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        members: [memberObjectId],
        guide: guideObjectId,
        title: 'Groupe A',
      }),
    });
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
    const memberObjectId = new Types.ObjectId(pilgrimId);
    groupModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        members: [memberObjectId],
        guide: undefined,
        title: 'Groupe A',
      }),
    });
    usersService.findByIdOrFail.mockResolvedValue({
      fullName: 'Amadou Diallo',
      emergencyContact: undefined,
    });

    await service.triggerSos(pilgrimId, groupId);

    expect(notificationsService.send).not.toHaveBeenCalled();
    expect(notificationsService.sendRawSms).not.toHaveBeenCalled();
  });
});
