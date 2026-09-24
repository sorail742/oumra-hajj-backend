import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MinLength } from 'class-validator';

export class SendCommunityMessageDto {
  @ApiProperty({ description: 'Contenu textuel du message' })
  @IsString()
  @MinLength(1)
  content!: string;

  // Horodatage client (offline-first, voir ADR 0007 / 0014 / 0023)
  @ApiProperty({ description: "Horodatage de l'envoi côté client" })
  @IsDateString()
  clientSentAt!: string;
}

