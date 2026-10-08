import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { GuidePlanningController } from './guide-planning.controller';
import { GuidePlanningService } from './guide-planning.service';

@Module({
  imports: [AgenciesModule],
  controllers: [GuidePlanningController],
  providers: [GuidePlanningService],
})
export class GuidePlanningModule {}
