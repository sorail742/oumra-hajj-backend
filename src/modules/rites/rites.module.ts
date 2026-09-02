import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RiteProgressService } from './rite-progress.service';
import { RiteSheetsService } from './rite-sheets.service';
import { RitesController } from './rites.controller';
import {
  RiteProgress,
  RiteProgressSchema,
} from './schemas/rite-progress.schema';
import { RiteSheet, RiteSheetSchema } from './schemas/rite-sheet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RiteSheet.name, schema: RiteSheetSchema },
      { name: RiteProgress.name, schema: RiteProgressSchema },
    ]),
  ],
  controllers: [RitesController],
  providers: [RiteSheetsService, RiteProgressService],
  exports: [RiteSheetsService, RiteProgressService],
})
export class RitesModule {}
