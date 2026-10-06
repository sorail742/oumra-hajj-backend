import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../config/configuration';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';

const AUDIENCE = 'ws';

interface TicketPayload {
  sub: string;
  role: Role;
  jti: string;
  exp: number;
}

// Ticket WebSocket (ADR 0027) : JWT signé avec un secret distinct de
// l'access token, audience `ws`, 30 s, à usage unique. Le web l'obtient via
// son proxy authentifié et le présente au handshake Socket.IO ; l'access
// token ne quitte jamais le cookie httpOnly (ADR-0002 du web).
//
// Les identifiants déjà consommés sont gardés en mémoire jusqu'à leur
// expiration : suffisant pour une instance unique (Render, ADR 0024) ; à
// déplacer dans un stockage partagé si l'API passe à plusieurs instances.
@Injectable()
export class RealtimeTicketService {
  private readonly consommes = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async issue(user: JwtPayload): Promise<{ ticket: string; expiresAt: Date }> {
    const { ticketSecret, ticketTtlSeconds } = this.configService.get(
      'realtime',
      { infer: true },
    );
    if (ticketSecret === '') {
      throw new ServiceUnavailableException(
        "Le temps réel n'est pas configuré sur ce serveur",
      );
    }
    const ticket = await this.jwtService.signAsync(
      { sub: user.sub, role: user.role },
      {
        secret: ticketSecret,
        expiresIn: ticketTtlSeconds,
        audience: AUDIENCE,
        jwtid: randomUUID(),
      },
    );
    return {
      ticket,
      expiresAt: new Date(Date.now() + ticketTtlSeconds * 1000),
    };
  }

  async consume(ticket: string): Promise<JwtPayload> {
    const { ticketSecret } = this.configService.get('realtime', {
      infer: true,
    });
    if (ticketSecret === '') {
      throw new UnauthorizedException('Temps réel non configuré');
    }
    let payload: TicketPayload;
    try {
      payload = await this.jwtService.verifyAsync<TicketPayload>(ticket, {
        secret: ticketSecret,
        audience: AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Ticket invalide ou expiré');
    }

    this.oublierExpires();
    if (this.consommes.has(payload.jti)) {
      throw new UnauthorizedException('Ticket déjà utilisé');
    }
    this.consommes.set(payload.jti, payload.exp * 1000);
    return { sub: payload.sub, role: payload.role };
  }

  private oublierExpires(): void {
    const maintenant = Date.now();
    for (const [jti, expiration] of this.consommes) {
      if (expiration < maintenant) {
        this.consommes.delete(jti);
      }
    }
  }
}
