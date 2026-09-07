import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { GroupsModule } from '../groups/groups.module';
import { PackagesModule } from '../packages/packages.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AgenciesModule, PackagesModule, GroupsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
