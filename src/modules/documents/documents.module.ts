import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalDiskStorageProvider } from './storage/local-disk-storage-provider.service';
import { LocalFilesController } from './storage/local-files.controller';
import { STORAGE_PROVIDER } from './storage/storage-provider.interface';

@Module({
  imports: [AgenciesModule, BookingsModule],
  controllers: [DocumentsController, LocalFilesController],
  providers: [
    DocumentsService,
    LocalDiskStorageProvider,
    // `useExisting` plutôt que `useClass` : `LocalFilesController` a besoin
    // d'injecter la classe concrète (pour `resolveSignedToken`, absent de
    // l'abstraction `StorageProvider`) — les deux doivent partager la même
    // instance plutôt que d'en construire une seconde.
    { provide: STORAGE_PROVIDER, useExisting: LocalDiskStorageProvider },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
