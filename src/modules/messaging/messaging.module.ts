import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/configuration';
import { WsJwtAuthGuard } from '../../common/guards/ws-jwt-auth.guard';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

@Module({
  imports: [
    BookingsModule,
    AgenciesModule,
    GroupsModule,
    NotificationsModule,
    // Meme secret que le REST (AuthModule) pour la verification du handshake
    // websocket — voir WsJwtAuthGuard. Enregistre ici plutot qu'importe
    // depuis AuthModule : JwtModule n'y est pas exporte, et dupliquer cette
    // config minimale evite un couplage inter-module inutile.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.get('jwt', { infer: true }).accessSecret,
      }),
    }),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway, WsJwtAuthGuard],
  exports: [MessagingService],
})
export class MessagingModule {}
