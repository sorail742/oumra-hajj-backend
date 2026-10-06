import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AppConfig } from '../../config/configuration';
import { JwtPayload } from '../interfaces/authenticated-request.interface';
import { RealtimeTicketService } from '../../modules/realtime/realtime-ticket.service';

// Authentification du handshake websocket (voir ADR 0014). Les guards Nest
// (@UseGuards) ne s'appliquent qu'aux handlers @SubscribeMessage, jamais aux
// hooks de cycle de vie handleConnection/handleDisconnect — la verification
// se fait donc explicitement dans handleConnection (voir MessagingGateway),
// pas via l'interface CanActivate.
//
// Deux preuves acceptees (ADR 0027) :
// - `auth.ticket` : ticket ephemere a usage unique, obtenu en REST — seul
//   moyen pour le web, dont l'access token reste dans un cookie httpOnly ;
// - `auth.token` / en-tete Authorization : l'access token, pour l'application
//   mobile qui le detient deja hors de portee d'un script de page.
@Injectable()
export class WsJwtAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly realtimeTicketService: RealtimeTicketService,
  ) {}

  async authenticate(client: Socket): Promise<JwtPayload> {
    const ticket = client.handshake.auth?.ticket as string | undefined;
    if (ticket) {
      return this.realtimeTicketService.consume(ticket);
    }

    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('jwt', { infer: true }).accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  // `auth.token` (convention socket.io-client : `io(url, { auth: { token } })`)
  // en priorite, en-tete Authorization en repli pour les clients qui ne
  // suivent que la convention HTTP classique.
  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) {
      return fromAuth;
    }
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }
}
