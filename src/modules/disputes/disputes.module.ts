import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DisputePurgeService } from './dispute-purge.service';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService, DisputePurgeService],
})
export class DisputesModule {}
