import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

// Requête multipart/form-data : label et expiresAt en champs de formulaire,
// fichier dans le champ `file` (voir AgenciesController.addLegalDocument).
// Idée #56 (backlog "Cent Fonctionnalités") — `expiresAt` est optionnel : un
// document sans date d'expiration connue (ex. statuts de société) ne doit
// jamais se voir attribuer une date arbitraire.
export class AddLegalDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  label!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
