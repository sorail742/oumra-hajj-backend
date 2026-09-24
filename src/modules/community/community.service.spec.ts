import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CommunityService } from './community.service';

describe('CommunityService — Communauté pré-départ (Ticket #5, ADR 0023)', () => {
  let service: CommunityService;
  let prisma: {
    communityMessage: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let groupsService: {
    findAuthorizedOrFail: jest.Mock;
  };

  const groupId = 'group-1';
  const pilgrimUser: JwtPayload = {
    sub: 'pilgrim-1',
    role: Role.PILGRIM,
  };
  const strangerUser: JwtPayload = {
    sub: 'stranger-1',
    role: Role.PILGRIM,
  };

  const mockMessage = {
    id: 'msg-1',
    groupId,
    senderId: pilgrimUser.sub,
    content: 'Bonjour à tout le groupe !',
    clientSentAt: new Date('2026-09-24T10:00:00Z'),
    createdAt: new Date('2026-09-24T10:00:01Z'),
    sender: {
      fullName: 'Ahmed Pilgrim',
    },
  };

  beforeEach(async () => {
    prisma = {
      communityMessage: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    groupsService = {
      findAuthorizedOrFail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: PrismaService, useValue: prisma },
        { provide: GroupsService, useValue: groupsService },
      ],
    }).compile();

    service = module.get(CommunityService);
  });

  describe('assertAccessToGroup', () => {
    it('autorise un membre légitime du groupe', async () => {
      groupsService.findAuthorizedOrFail.mockResolvedValue({ id: groupId });

      await expect(
        service.assertAccessToGroup(groupId, pilgrimUser),
      ).resolves.not.toThrow();

      expect(groupsService.findAuthorizedOrFail).toHaveBeenCalledWith(
        pilgrimUser.sub,
        pilgrimUser.role,
        groupId,
      );
    });

    it('rejette un utilisateur non autorisé avec ForbiddenException', async () => {
      groupsService.findAuthorizedOrFail.mockRejectedValue(
        new ForbiddenException("Vous n'avez pas accès à ce groupe"),
      );

      await expect(
        service.assertAccessToGroup(groupId, strangerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le groupe n existe pas', async () => {
      groupsService.findAuthorizedOrFail.mockRejectedValue(
        new NotFoundException('Groupe introuvable'),
      );

      await expect(
        service.assertAccessToGroup('unknown', pilgrimUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMessages', () => {
    it('renvoie les messages ordonnés chronologiquement avec le nom de l auteur', async () => {
      groupsService.findAuthorizedOrFail.mockResolvedValue({ id: groupId });
      prisma.communityMessage.findMany.mockResolvedValue([mockMessage]);

      const result = await service.listMessages(groupId, pilgrimUser);

      expect(groupsService.findAuthorizedOrFail).toHaveBeenCalledWith(
        pilgrimUser.sub,
        pilgrimUser.role,
        groupId,
      );
      expect(prisma.communityMessage.findMany).toHaveBeenCalledWith({
        where: { groupId },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              fullName: true,
            },
          },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'msg-1',
        groupId,
        senderId: pilgrimUser.sub,
        senderName: 'Ahmed Pilgrim',
        content: 'Bonjour à tout le groupe !',
        clientSentAt: mockMessage.clientSentAt,
        createdAt: mockMessage.createdAt,
      });
    });

    it('bloque la lecture si l utilisateur n est pas membre du groupe', async () => {
      groupsService.findAuthorizedOrFail.mockRejectedValue(
        new ForbiddenException("Vous n'avez pas accès à ce groupe"),
      );

      await expect(service.listMessages(groupId, strangerUser)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.communityMessage.findMany).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('crée et persiste un message pour un membre autorisé', async () => {
      groupsService.findAuthorizedOrFail.mockResolvedValue({ id: groupId });
      prisma.communityMessage.create.mockResolvedValue(mockMessage);

      const dto = {
        content: 'Bonjour à tout le groupe !',
        clientSentAt: '2026-09-24T10:00:00Z',
      };

      const result = await service.sendMessage(groupId, pilgrimUser, dto);

      expect(groupsService.findAuthorizedOrFail).toHaveBeenCalledWith(
        pilgrimUser.sub,
        pilgrimUser.role,
        groupId,
      );
      expect(prisma.communityMessage.create).toHaveBeenCalledWith({
        data: {
          groupId,
          senderId: pilgrimUser.sub,
          content: dto.content,
          clientSentAt: new Date(dto.clientSentAt),
        },
        include: {
          sender: {
            select: {
              fullName: true,
            },
          },
        },
      });
      expect(result.senderName).toBe('Ahmed Pilgrim');
      expect(result.content).toBe('Bonjour à tout le groupe !');
    });

    it('bloque l envoi de message si l utilisateur est un étranger au groupe', async () => {
      groupsService.findAuthorizedOrFail.mockRejectedValue(
        new ForbiddenException("Vous n'avez pas accès à ce groupe"),
      );

      await expect(
        service.sendMessage(groupId, strangerUser, {
          content: 'Spam',
          clientSentAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.communityMessage.create).not.toHaveBeenCalled();
    });
  });
});
