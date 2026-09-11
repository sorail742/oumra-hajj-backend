import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalDiskStorageProvider } from './storage/local-disk-storage-provider.service';
import { STORAGE_PROVIDER } from './storage/storage-provider.interface';

@Module({
  imports: [AgenciesModule, BookingsModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    { provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
