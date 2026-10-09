import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { ProfitabilityController } from './profitability.controller';
import { ProfitabilityService } from './profitability.service';

@Module({
  imports: [AgenciesModule],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService],
})
export class ProfitabilityModule {}
