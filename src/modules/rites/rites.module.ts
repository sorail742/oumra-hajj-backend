import { Module } from '@nestjs/common';
import { RiteProgressService } from './rite-progress.service';
import { RiteSheetsService } from './rite-sheets.service';
import { RitesController } from './rites.controller';

@Module({
  controllers: [RitesController],
  providers: [RiteSheetsService, RiteProgressService],
  exports: [RiteSheetsService, RiteProgressService],
})
export class RitesModule {}
