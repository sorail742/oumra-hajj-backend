import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('CommunityController', () => {
  let controller: CommunityController;
  let service: {
    listMessages: jest.Mock;
    sendMessage: jest.Mock;
  };

  const user: JwtPayload = {
    sub: 'pilgrim-1',
    role: Role.PILGRIM,
  };

  const mockMessage = {
    id: 'msg-1',
    groupId: 'group-1',
    senderId: user.sub,
    senderName: 'Ahmed Pilgrim',
    content: 'Salam alaykoum',
    clientSentAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      listMessages: jest.fn(),
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [{ provide: CommunityService, useValue: service }],
    }).compile();

    controller = module.get(CommunityController);
  });

  it('listMessages appelle service.listMessages', async () => {
    service.listMessages.mockResolvedValue([mockMessage]);

    const result = await controller.listMessages(user, 'group-1');

    expect(service.listMessages).toHaveBeenCalledWith('group-1', user);
    expect(result).toEqual([mockMessage]);
  });

  it('sendMessage appelle service.sendMessage', async () => {
    service.sendMessage.mockResolvedValue(mockMessage);

    const dto = {
      content: 'Salam alaykoum',
      clientSentAt: new Date().toISOString(),
    };

    const result = await controller.sendMessage(user, 'group-1', dto);

    expect(service.sendMessage).toHaveBeenCalledWith('group-1', user, dto);
    expect(result).toEqual(mockMessage);
  });
});
