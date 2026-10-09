import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { OnCallController } from './on-call.controller';
import { OnCallService } from './on-call.service';

@Module({
  imports: [AgenciesModule],
  controllers: [OnCallController],
  providers: [OnCallService],
})
export class OnCallModule {}
