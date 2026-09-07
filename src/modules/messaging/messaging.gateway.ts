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
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { MessageShape } from '../../types';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

interface SendMessagePayload extends SendMessageDto {
  conversationId: string;
}

// Une room Socket.IO par conversation (voir ADR 0014) : le client la
// rejoint explicitement via `conversation:join` apres avoir recupere l'id de
// la conversation en REST (GET /messaging/bookings/:id/conversations/:channel)
// — la connexion socket seule n'a pas encore cette information.
@WebSocketGateway({ namespace: 'messaging' })
export class MessagingGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly wsJwtAuthGuard: WsJwtAuthGuard,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      client.data.user = await this.wsJwtAuthGuard.authenticate(client);
    } catch {
      this.logger.warn(`Connexion refusée (${client.id}) : token invalide`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    const user = client.data.user as JwtPayload;
    // Ne fait jamais confiance a un conversationId fourni par le client sans
    // verification — voir MessagingService.assertAccessToConversation.
    await this.messagingService.assertAccessToConversation(
      conversationId,
      user.sub,
    );
    await client.join(conversationId);
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<MessageShape> {
    const user = client.data.user as JwtPayload;
    const message = await this.messagingService.sendMessage(
      payload.conversationId,
      user.sub,
      { content: payload.content, clientSentAt: payload.clientSentAt },
    );
    this.server.to(payload.conversationId).emit('message:new', message);
    return message;
  }
}
