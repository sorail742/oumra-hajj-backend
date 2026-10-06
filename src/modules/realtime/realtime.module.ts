import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeSessionsService } from './realtime-sessions.service';
import { RealtimeTicketService } from './realtime-ticket.service';

// Temps réel (ADR 0027) : tickets WebSocket et sessions ouvertes, partagés
// par l'authentification et les gateways `messaging` et `community`.
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeTicketService, RealtimeSessionsService],
  exports: [RealtimeTicketService, RealtimeSessionsService],
})
export class RealtimeModule {}
