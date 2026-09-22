import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { FamilyViewController } from './family-view.controller';

@Module({
  imports: [BookingsModule],
  controllers: [FamilyViewController],
})
export class FamilyViewModule {}
