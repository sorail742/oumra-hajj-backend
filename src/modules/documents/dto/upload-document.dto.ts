import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';

// Requête multipart/form-data : bookingId, type et expiresAt en champs de
// formulaire, fichier dans le champ `file` (voir DocumentsController.upload).
// Le téléversement effectif vers le service de stockage objet (voir ADR 0008)
// est géré côté serveur par StorageProvider — le client n'a jamais à
// connaître ni fournir de référence de stockage.
export class UploadDocumentDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ enum: PilgrimDocumentType })
  @IsEnum(PilgrimDocumentType)
  type!: PilgrimDocumentType;

  // Idée #59 (backlog "Cent Fonctionnalités") : optionnelle — un billet
  // d'avion n'a pas de date d'expiration, et le pèlerin peut ne pas la
  // connaître au moment de l'upload.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
