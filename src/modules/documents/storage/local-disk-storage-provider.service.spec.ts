import { ConfigService } from '@nestjs/config';
import { rm } from 'fs/promises';
import { join } from 'path';
import { AppConfig } from '../../../config/configuration';
import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';
import { LocalDiskStorageProvider } from './local-disk-storage-provider.service';

function buildProvider(secret = 'test-secret'): LocalDiskStorageProvider {
  const configService = {
    get: jest.fn().mockReturnValue({ accessSecret: secret }),
  } as unknown as ConfigService<AppConfig, true>;
  return new LocalDiskStorageProvider(configService);
}

describe("LocalDiskStorageProvider — URL d'accès signées (ADR 0008)", () => {
  const uploadRoot = join(process.cwd(), 'uploads', 'documents');

  afterAll(async () => {
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('génère un token vérifiable qui renvoie le bon nom de fichier', async () => {
    const provider = buildProvider();
    const { storageRef } = await provider.store(
      'pilgrim-1',
      PilgrimDocumentType.PASSPORT,
      {
        buffer: Buffer.from('contenu'),
        originalName: 'passeport.jpg',
        mimeType: 'image/jpeg',
      },
    );

    const { url, expiresAt } = await provider.getAccessUrl(storageRef);
    const token = url.split('/').pop()!;
    const expectedFileName = storageRef.replace('local://documents/', '');

    expect(provider.resolveSignedToken(token)).toBe(expectedFileName);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuse un token expiré', async () => {
    const provider = buildProvider();
    const realNow = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(realNow);
    const { url } = await provider.getAccessUrl(
      'local://documents/x-passport-1.jpg',
    );

    // Avance l'horloge de 6 min (au-delà du TTL de 5 min) avant de vérifier
    // le token — simule le délai écoulé sans dépendre d'une vraie attente.
    spy.mockReturnValue(realNow + 6 * 60 * 1000);

    const token = url.split('/').pop()!;
    expect(provider.resolveSignedToken(token)).toBeNull();
    spy.mockRestore();
  });

  it('refuse un token altéré (signature invalide)', async () => {
    const provider = buildProvider();
    const { url } = await provider.getAccessUrl(
      'local://documents/x-passport-1.jpg',
    );
    const token = url.split('/').pop()!;
    const tampered = `${token.slice(0, -2)}zz`;

    expect(provider.resolveSignedToken(tampered)).toBeNull();
  });

  it("refuse un token signé avec un secret différent (l'un ne peut pas forger de token pour l'autre)", async () => {
    const providerA = buildProvider('secret-a');
    const providerB = buildProvider('secret-b');
    const { url } = await providerA.getAccessUrl(
      'local://documents/x-passport-1.jpg',
    );
    const token = url.split('/').pop()!;

    expect(providerB.resolveSignedToken(token)).toBeNull();
  });

  it('refuse un token mal formé', () => {
    const provider = buildProvider();
    expect(provider.resolveSignedToken('pas-un-token-valide')).toBeNull();
  });
});
