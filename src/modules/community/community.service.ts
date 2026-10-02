import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityMessageShape } from '../../types/community.types';
import { GroupsService } from '../groups/groups.service';
import { SendCommunityMessageDto } from './dto/send-community-message.dto';

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  async assertAccessToGroup(groupId: string, user: JwtPayload): Promise<void> {
    await this.groupsService.findAuthorizedOrFail(user.sub, user.role, groupId);
  }

  async listMessages(
    groupId: string,
    user: JwtPayload,
  ): Promise<CommunityMessageShape[]> {
    await this.assertAccessToGroup(groupId, user);

    const messages = await this.prisma.communityMessage.findMany({
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

    return messages.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      senderId: m.senderId,
      senderName: m.sender.fullName,
      content: m.content,
      clientSentAt: m.clientSentAt,
      createdAt: m.createdAt,
    }));
  }

  async sendMessage(
    groupId: string,
    user: JwtPayload,
    dto: SendCommunityMessageDto,
  ): Promise<CommunityMessageShape> {
    await this.assertAccessToGroup(groupId, user);

    const message = await this.prisma.communityMessage.create({
      data: {
        groupId,
        senderId: user.sub,
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

    return {
      id: message.id,
      groupId: message.groupId,
      senderId: message.senderId,
      senderName: message.sender.fullName,
      content: message.content,
      clientSentAt: message.clientSentAt,
      createdAt: message.createdAt,
    };
  }
}
