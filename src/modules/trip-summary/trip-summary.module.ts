import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PackagesModule } from '../packages/packages.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { RitesModule } from '../rites/rites.module';
import { TripSummaryController } from './trip-summary.controller';
import { TripSummaryService } from './trip-summary.service';

@Module({
  imports: [
    BookingsModule,
    PackagesModule,
    AgenciesModule,
    PaymentsModule,
    RitesModule,
    ReviewsModule,
  ],
  controllers: [TripSummaryController],
  providers: [TripSummaryService],
})
export class TripSummaryModule {}
