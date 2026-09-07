import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { PilgrimDocumentType } from '../../../common/enums/pilgrim-document-type.enum';

// Le téléversement effectif du fichier passe par le service de stockage
// objet (voir ADR 0008) ; cette API n'échange que la référence obtenue.
export class UploadDocumentDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ enum: PilgrimDocumentType })
  @IsEnum(PilgrimDocumentType)
  type!: PilgrimDocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  storageRef!: string;
}
