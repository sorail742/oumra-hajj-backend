import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { WsJwtAuthGuard } from '../../common/guards/ws-jwt-auth.guard';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CommunityGateway } from './community.gateway';
import { CommunityService } from './community.service';

describe('CommunityGateway', () => {
  let gateway: CommunityGateway;
  let service: {
    assertAccessToGroup: jest.Mock;
    sendMessage: jest.Mock;
  };
  let wsGuard: {
    authenticate: jest.Mock;
  };

  const user: JwtPayload = {
    sub: 'user-1',
    role: Role.PILGRIM,
  };

  beforeEach(async () => {
    service = {
      assertAccessToGroup: jest.fn(),
      sendMessage: jest.fn(),
    };
    wsGuard = {
      authenticate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityGateway,
        { provide: CommunityService, useValue: service },
        { provide: WsJwtAuthGuard, useValue: wsGuard },
      ],
    }).compile();

    gateway = module.get(CommunityGateway);
    // Inject mock server
    (gateway as unknown as { server: unknown }).server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };
  });

  describe('handleConnection', () => {
    it('authentifie le socket avec succès', async () => {
      const client = {
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      wsGuard.authenticate.mockResolvedValue(user);

      await gateway.handleConnection(client);

      expect(client.data.user).toEqual(user);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('déconnecte le client si le token est invalide', async () => {
      const client = {
        id: 'socket-fail',
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      wsGuard.authenticate.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleJoin', () => {
    it('vérifie l accès au groupe puis rejoint la room Socket.IO', async () => {
      const client = {
        data: { user },
        join: jest.fn(),
      } as unknown as Socket;

      await gateway.handleJoin(client, 'group-1');

      expect(service.assertAccessToGroup).toHaveBeenCalledWith('group-1', user);
      expect(client.join).toHaveBeenCalledWith('group:group-1');
    });
  });

  describe('handleSend', () => {
    it('envoie le message et le diffuse à la room du groupe', async () => {
      const client = {
        data: { user },
      } as unknown as Socket;

      const mockMessage = {
        id: 'msg-1',
        groupId: 'group-1',
        senderId: user.sub,
        content: 'Salam',
        clientSentAt: new Date(),
        createdAt: new Date(),
      };

      service.sendMessage.mockResolvedValue(mockMessage);

      const payload = {
        groupId: 'group-1',
        content: 'Salam',
        clientSentAt: new Date().toISOString(),
      };

      const result = await gateway.handleSend(client, payload);

      expect(service.sendMessage).toHaveBeenCalledWith('group-1', user, {
        content: 'Salam',
        clientSentAt: payload.clientSentAt,
      });
      expect(result).toEqual(mockMessage);
    });
  });
});

