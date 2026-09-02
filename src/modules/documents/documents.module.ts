import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import {
  PilgrimDocument,
  PilgrimDocumentSchema,
} from './schemas/document.schema';

@Module({
  imports: [
    AgenciesModule,
    BookingsModule,
    MongooseModule.forFeature([
      { name: PilgrimDocument.name, schema: PilgrimDocumentSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
