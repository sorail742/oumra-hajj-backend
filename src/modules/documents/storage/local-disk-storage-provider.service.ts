import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { AppConfig } from '../../../config/configuration';
import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';
import {
  AccessUrl,
  StorageProvider,
  StoredFile,
} from './storage-provider.interface';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'documents');
const ACCESS_URL_TTL_MS = 5 * 60 * 1000; // 5 min — "durée de vie courte", ADR 0008.
const FILE_NAME_PATTERN = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/;

interface SignedPayload {
  f: string; // fileName
  e: number; // expiresAt (ms epoch)
}

// Implémentation temporaire (disque local) tant que Firebase Storage n'est
// pas intégré (voir ADR 0008, note du 2026-09-10). Ne jamais utiliser en
// production : aucun chiffrement au repos, aucune haute disponibilité, et le
// dossier `uploads/` n'est pas répliqué entre instances.
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name);
  private readonly signingSecret: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    // Réutilise le secret JWT access existant plutôt que d'ajouter une
    // variable d'environnement dédiée pour ce mécanisme de signature interne
    // — aucune donnée d'authentification n'y transite, juste un nom de
    // fichier et une expiration.
    this.signingSecret = configService.get('jwt', { infer: true }).accessSecret;
  }

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

  async getAccessUrl(storageRef: string): Promise<AccessUrl> {
    const fileName = storageRef.replace('local://documents/', '');
    const expiresAt = new Date(Date.now() + ACCESS_URL_TTL_MS);
    const token = this.sign({ f: fileName, e: expiresAt.getTime() });
    return { url: `/api/v1/documents/files/${token}`, expiresAt };
  }

  // Vérifie un token émis par `getAccessUrl` et renvoie le nom de fichier
  // s'il est valide et non expiré — `null` sinon. Utilisé par
  // `LocalFilesController`, seul consommateur légitime de cette méthode
  // (spécifique à cette implémentation, absente de `StorageProvider`).
  resolveSignedToken(token: string): string | null {
    let payload: string;
    let hmac: string;
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      ({ p: payload, h: hmac } = JSON.parse(decoded) as {
        p: string;
        h: string;
      });
    } catch {
      return null;
    }

    const expectedHmac = this.computeHmac(payload);
    const provided = Buffer.from(hmac);
    const expected = Buffer.from(expectedHmac);
    if (provided.length !== expected.length) {
      return null;
    }
    if (!timingSafeEqual(provided, expected)) {
      return null;
    }

    let parsed: SignedPayload;
    try {
      parsed = JSON.parse(payload) as SignedPayload;
    } catch {
      return null;
    }

    if (parsed.e < Date.now()) {
      return null;
    }
    // Défense en profondeur : le nom de fichier ne devrait jamais pouvoir
    // s'écarter de ce format (voir `store` ci-dessus), même signé — évite
    // tout risque de traversée de chemin si l'implémentation venait à
    // changer.
    if (!FILE_NAME_PATTERN.test(parsed.f)) {
      return null;
    }

    return parsed.f;
  }

  private sign(payload: SignedPayload): string {
    const serialized = JSON.stringify(payload);
    const hmac = this.computeHmac(serialized);
    return Buffer.from(JSON.stringify({ p: serialized, h: hmac })).toString(
      'base64url',
    );
  }

  private computeHmac(payload: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');
  }
}
