import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PackagesModule } from '../packages/packages.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AgenciesModule, BookingsModule, PackagesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
