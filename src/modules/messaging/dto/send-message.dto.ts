import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;

  // Horodatage client (offline-first, voir ADR 0007/0014) — le serveur reste
  // seul juge de l'ordre de persistance via `createdAt`.
  @ApiProperty()
  @IsDateString()
  clientSentAt!: string;
}
