import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

// Abstraction du service de stockage objet — voir ADR 0008. Firebase Storage
// retenu (note du 2026-09-10), intégration réelle à brancher ici une fois le
// projet Firebase et les identifiants de service disponibles. En attendant,
// `LocalDiskStorageProvider` stocke réellement les fichiers sur disque pour
// que le parcours coffre-fort documents reste testable de bout en bout.
export interface StorageProvider {
  store(
    pilgrimId: string,
    type: PilgrimDocumentType,
    file: StoredFile,
  ): Promise<{ storageRef: string }>;
}
