import {
  Controller,
  Get,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { join } from 'path';
import { Public } from '../../../common/decorators/public.decorator';
import { LocalDiskStorageProvider } from './local-disk-storage-provider.service';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'documents');

// Sert les fichiers stockés par `LocalDiskStorageProvider` via une URL
// signée à durée de vie courte (voir ADR 0008, `DocumentsService.getAccessUrl`)
// — l'autorisation a déjà été vérifiée au moment de générer le lien, pas ici
// (la validité du token en tient lieu). N'existe qu'en développement :
// Firebase Storage génère ses propres URLs signées nativement, ce
// contrôleur n'aura plus de raison d'être une fois branché.
@ApiExcludeController()
@Controller('documents/files')
export class LocalFilesController {
  constructor(private readonly storageProvider: LocalDiskStorageProvider) {}

  @Public()
  @Get(':token')
  getFile(@Param('token') token: string): StreamableFile {
    const fileName = this.storageProvider.resolveSignedToken(token);
    if (!fileName) {
      throw new NotFoundException('Lien invalide ou expiré');
    }
    return new StreamableFile(createReadStream(join(UPLOAD_ROOT, fileName)));
  }
}
