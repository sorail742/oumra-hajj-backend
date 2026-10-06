import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AppConfig } from '../../config/configuration';
import { Role } from '../../common/enums/role.enum';
import { RealtimeSessionsService } from './realtime-sessions.service';
import { RealtimeTicketService } from './realtime-ticket.service';

// Secrets explicitement factices.
const REALTIME = {
  ticketSecret: 'secret-ticket-factice',
  ticketTtlSeconds: 30,
  sessionMaxMinutes: 15,
};

function config(realtime = REALTIME): ConfigService<AppConfig, true> {
  return {
    get: (key: keyof AppConfig) => (key === 'realtime' ? realtime : undefined),
  } as unknown as ConfigService<AppConfig, true>;
}

const PELERIN = { sub: 'pelerin-1', role: Role.PILGRIM };

describe('RealtimeTicketService', () => {
  const jwt = new JwtService({});
  let service: RealtimeTicketService;

  beforeEach(() => {
    service = new RealtimeTicketService(jwt, config());
  });

  it('émet un ticket de 30 s qui identifie le demandeur', async () => {
    const { ticket, expiresAt } = await service.issue(PELERIN);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30_000);
    await expect(service.consume(ticket)).resolves.toEqual(PELERIN);
  });

  it('refuse un ticket déjà utilisé', async () => {
    const { ticket } = await service.issue(PELERIN);
    await service.consume(ticket);
    await expect(service.consume(ticket)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un access token ou un ticket signé avec un autre secret', async () => {
    const accessToken = await jwt.signAsync(PELERIN, {
      secret: 'secret-acces-factice',
    });
    await expect(service.consume(accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("refuse un jeton du bon secret mais sans l'audience ws", async () => {
    const sansAudience = await jwt.signAsync(PELERIN, {
      secret: REALTIME.ticketSecret,
      jwtid: 'jti-factice',
    });
    await expect(service.consume(sansAudience)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un ticket expiré', async () => {
    const expire = await jwt.signAsync(
      { ...PELERIN, exp: Math.floor(Date.now() / 1000) - 1 },
      { secret: REALTIME.ticketSecret, audience: 'ws', jwtid: 'jti-expire' },
    );
    await expect(service.consume(expire)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RealtimeTicketService sans secret (production non configurée)', () => {
  it("refuse d'émettre et d'accepter le moindre ticket", async () => {
    const jwt = new JwtService({});
    const service = new RealtimeTicketService(
      jwt,
      config({ ...REALTIME, ticketSecret: '' }),
    );
    await expect(service.issue(PELERIN)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const forge = await jwt.signAsync(PELERIN, {
      secret: 'dev-realtime-secret-change-me',
      audience: 'ws',
      jwtid: 'jti-forge',
    });
    await expect(service.consume(forge)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RealtimeSessionsService', () => {
  function faux(): Socket & { fermer: () => void } {
    const ecouteurs: Array<() => void> = [];
    const client = {
      disconnect: jest.fn(() => ecouteurs.forEach((f) => f())),
      once: jest.fn((_evt: string, f: () => void) => ecouteurs.push(f)),
      fermer: () => ecouteurs.forEach((f) => f()),
    };
    return client as unknown as Socket & { fermer: () => void };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("ferme toutes les connexions d'un utilisateur à sa déconnexion", () => {
    const sessions = new RealtimeSessionsService(config());
    const a = faux();
    const b = faux();
    const autre = faux();
    sessions.register(a, 'pelerin-1');
    sessions.register(b, 'pelerin-1');
    sessions.register(autre, 'pelerin-2');

    sessions.disconnectUser('pelerin-1');

    expect(a.disconnect).toHaveBeenCalledWith(true);
    expect(b.disconnect).toHaveBeenCalledWith(true);
    expect(autre.disconnect).not.toHaveBeenCalled();
  });

  it('ferme une connexion au bout de 15 minutes', () => {
    const sessions = new RealtimeSessionsService(config());
    const client = faux();
    sessions.register(client, 'pelerin-1');

    jest.advanceTimersByTime(15 * 60_000 - 1);
    expect(client.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
