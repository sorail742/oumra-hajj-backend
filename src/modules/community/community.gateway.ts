import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtAuthGuard } from '../../common/guards/ws-jwt-auth.guard';
import { RealtimeSessionsService } from '../realtime/realtime-sessions.service';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CommunityMessageShape } from '../../types/community.types';
import { CommunityService } from './community.service';
import { SendCommunityMessageDto } from './dto/send-community-message.dto';

interface SendCommunityMessagePayload extends SendCommunityMessageDto {
  groupId: string;
}

@WebSocketGateway({ namespace: 'community' })
export class CommunityGateway implements OnGatewayConnection {
  private readonly logger = new Logger(CommunityGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly communityService: CommunityService,
    private readonly wsJwtAuthGuard: WsJwtAuthGuard,
    private readonly realtimeSessions: RealtimeSessionsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.wsJwtAuthGuard.authenticate(client);
      client.data.user = user;
      this.realtimeSessions.register(client, user.sub);
    } catch {
      this.logger.warn(
        `Connexion refusée sur community (${client.id}) : token invalide`,
      );
      client.disconnect(true);
    }
  }

  @SubscribeMessage('community:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: string,
  ): Promise<void> {
    const user = client.data.user as JwtPayload;
    await this.communityService.assertAccessToGroup(groupId, user);
    await client.join(`group:${groupId}`);
  }

  @SubscribeMessage('community:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendCommunityMessagePayload,
  ): Promise<CommunityMessageShape> {
    const user = client.data.user as JwtPayload;
    const message = await this.communityService.sendMessage(
      payload.groupId,
      user,
      {
        content: payload.content,
        clientSentAt: payload.clientSentAt,
      },
    );
    this.server.to(`group:${payload.groupId}`).emit('community:new', message);
    return message;
  }

  // Diffusion d'un message envoye en REST (le web envoie par le proxy
  // authentifie et n'ecoute que les evenements — ADR 0027).
  emitNewMessage(message: CommunityMessageShape): void {
    this.server.to(`group:${message.groupId}`).emit('community:new', message);
  }
}
