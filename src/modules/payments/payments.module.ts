import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PackagesModule } from '../packages/packages.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SavingsSchedulerService } from './savings-scheduler.service';
import { MockPaymentProvider } from './providers/mock-payment-provider.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

@Module({
  imports: [
    AgenciesModule,
    BookingsModule,
    PackagesModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    SavingsSchedulerService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
