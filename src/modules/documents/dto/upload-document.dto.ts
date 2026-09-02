import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsString, MinLength } from 'class-validator';
import { PilgrimDocumentType } from '../schemas/document.schema';

// Le téléversement effectif du fichier passe par le service de stockage
// objet (voir ADR 0008) ; cette API n'échange que la référence obtenue.
export class UploadDocumentDto {
  @ApiProperty()
  @IsMongoId()
  bookingId!: string;

  @ApiProperty({ enum: PilgrimDocumentType })
  @IsEnum(PilgrimDocumentType)
  type!: PilgrimDocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  storageRef!: string;
}
