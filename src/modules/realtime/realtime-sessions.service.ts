import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { AppConfig } from '../../config/configuration';

// Connexions WebSocket ouvertes, par utilisateur (ADR 0027) : chacune est
// fermée au bout de 15 min (le client se reconnecte avec un ticket neuf) et
// toutes celles d'un utilisateur à sa déconnexion (`POST /auth/logout`).
@Injectable()
export class RealtimeSessionsService {
  private readonly parUtilisateur = new Map<string, Set<Socket>>();

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  register(client: Socket, userId: string): void {
    const sockets = this.parUtilisateur.get(userId) ?? new Set<Socket>();
    sockets.add(client);
    this.parUtilisateur.set(userId, sockets);

    const { sessionMaxMinutes } = this.configService.get('realtime', {
      infer: true,
    });
    const minuterie = setTimeout(
      () => client.disconnect(true),
      sessionMaxMinutes * 60_000,
    );
    client.once('disconnect', () => {
      clearTimeout(minuterie);
      sockets.delete(client);
      if (sockets.size === 0) {
        this.parUtilisateur.delete(userId);
      }
    });
  }

  disconnectUser(userId: string): void {
    for (const client of this.parUtilisateur.get(userId) ?? []) {
      client.disconnect(true);
    }
  }
}
