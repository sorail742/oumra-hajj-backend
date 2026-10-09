import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { SeasonsController } from './seasons.controller';
import { SeasonsService } from './seasons.service';

@Module({
  imports: [AgenciesModule],
  controllers: [SeasonsController],
  providers: [SeasonsService],
})
export class SeasonsModule {}
