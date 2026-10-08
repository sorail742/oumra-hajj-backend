import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { GroupsController } from './groups.controller';
import { GroupRosterService } from './group-roster.service';
import { GroupsService } from './groups.service';

@Module({
  imports: [AgenciesModule, UsersModule, NotificationsModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupRosterService],
  exports: [GroupsService],
})
export class GroupsModule {}
