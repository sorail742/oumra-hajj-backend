import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PackagesModule } from '../packages/packages.module';
import { UsersModule } from '../users/users.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    AgenciesModule,
    PackagesModule,
    GroupsModule,
    NotificationsModule,
    UsersModule,
    ChecklistModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
