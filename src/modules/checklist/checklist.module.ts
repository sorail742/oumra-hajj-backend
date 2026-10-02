import { Module } from '@nestjs/common';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { ChecklistSchedulerService } from './checklist-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistSchedulerService],
  exports: [ChecklistService],
})
export class ChecklistModule {}
