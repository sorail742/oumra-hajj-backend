import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { CapacityController } from './capacity.controller';
import { CapacityService } from './capacity.service';

@Module({
  imports: [AgenciesModule],
  controllers: [CapacityController],
  providers: [CapacityService],
})
export class CapacityModule {}
