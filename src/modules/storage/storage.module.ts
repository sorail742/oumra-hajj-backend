import { Module } from '@nestjs/common';
import { LocalDiskStorageProvider } from './local-disk-storage-provider.service';
import { LocalFilesController } from './local-files.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';

// Module feuille (aucune dépendance sur les autres modules métier) afin de
// pouvoir être importé à la fois par `DocumentsModule` (documents pèlerins)
// et `AgenciesModule` (documents légaux agence, idée #56 backlog "Cent
// Fonctionnalités") sans créer de dépendance circulaire entre eux.
@Module({
  controllers: [LocalFilesController],
  providers: [
    LocalDiskStorageProvider,
    // `useExisting` plutôt que `useClass` : `LocalFilesController` a besoin
    // d'injecter la classe concrète (pour `resolveSignedToken`, absent de
    // l'abstraction `StorageProvider`) — les deux doivent partager la même
    // instance plutôt que d'en construire une seconde.
    { provide: STORAGE_PROVIDER, useExisting: LocalDiskStorageProvider },
  ],
  exports: [STORAGE_PROVIDER, LocalDiskStorageProvider],
})
export class StorageModule {}
