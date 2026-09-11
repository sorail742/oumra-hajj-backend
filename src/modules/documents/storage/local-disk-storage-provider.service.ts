import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';
import { StorageProvider, StoredFile } from './storage-provider.interface';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'documents');

// Implémentation temporaire (disque local) tant que Firebase Storage n'est
// pas intégré (voir ADR 0008, note du 2026-09-10). Ne jamais utiliser en
// production : aucun chiffrement au repos, aucune haute disponibilité, et le
// dossier `uploads/` n'est pas répliqué entre instances.
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name);

  async store(
    pilgrimId: string,
    type: PilgrimDocumentType,
    file: StoredFile,
  ): Promise<{ storageRef: string }> {
    await mkdir(UPLOAD_ROOT, { recursive: true });

    const fileName = `${pilgrimId}-${type}-${randomUUID()}${extname(file.originalName)}`;
    await writeFile(join(UPLOAD_ROOT, fileName), file.buffer);

    this.logger.warn(
      `[STOCKAGE DEV ONLY] Fichier écrit sur disque local : uploads/documents/${fileName} — provider de stockage réel non configuré (voir ADR 0008).`,
    );

    return { storageRef: `local://documents/${fileName}` };
  }
}
