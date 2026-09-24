import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { WsJwtAuthGuard } from '../../common/guards/ws-jwt-auth.guard';
import { AppConfig } from '../../config/configuration';
import { GroupsModule } from '../groups/groups.module';
import { CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { CommunityService } from './community.service';

@Module({
  imports: [
    GroupsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.get('jwt', { infer: true }).accessSecret,
      }),
    }),
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityGateway, WsJwtAuthGuard],
  exports: [CommunityService],
})
export class CommunityModule {}

