export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface AccessUrl {
  url: string;
  expiresAt: Date;
}

// Abstraction du service de stockage objet — voir ADR 0008. Firebase Storage
// retenu (note du 2026-09-10), intégration réelle à brancher ici une fois le
// projet Firebase et les identifiants de service disponibles. En attendant,
// `LocalDiskStorageProvider` stocke réellement les fichiers sur disque pour
// que le parcours coffre-fort documents reste testable de bout en bout.
//
// Partagé entre plusieurs domaines (documents pèlerins, documents légaux
// agence — voir idée #56 backlog "Cent Fonctionnalités") : `ownerId` et
// `type` restent des identifiants opaques du point de vue du stockage, qui
// ne connaît pas la sémantique métier de chaque domaine appelant.
export interface StorageProvider {
  store(
    ownerId: string,
    type: string,
    file: StoredFile,
  ): Promise<{ storageRef: string }>;

  // URL d'accès signée à durée de vie courte — jamais d'URL publique
  // permanente vers un document sensible (voir ADR 0008).
  getAccessUrl(storageRef: string): Promise<AccessUrl>;
}
