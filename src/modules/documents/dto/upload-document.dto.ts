import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';

// Requête multipart/form-data : bookingId et type en champs de formulaire,
// fichier dans le champ `file` (voir DocumentsController.upload). Le
// téléversement effectif vers le service de stockage objet (voir ADR 0008)
// est géré côté serveur par StorageProvider — le client n'a jamais à
// connaître ni fournir de référence de stockage.
export class UploadDocumentDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ enum: PilgrimDocumentType })
  @IsEnum(PilgrimDocumentType)
  type!: PilgrimDocumentType;
}
