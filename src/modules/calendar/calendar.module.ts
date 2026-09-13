import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { PackagesModule } from '../packages/packages.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [AgenciesModule, PackagesModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
