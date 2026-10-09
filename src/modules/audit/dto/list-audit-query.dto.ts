import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export class ListAuditQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Début inclus (défaut : il y a 30 jours)',
  })
  @IsOptional()
  @Matches(DATE_JOUR, { message: 'from doit être au format AAAA-MM-JJ' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: "Fin incluse (défaut : aujourd'hui)",
  })
  @IsOptional()
  @Matches(DATE_JOUR, { message: 'to doit être au format AAAA-MM-JJ' })
  to?: string;

  @ApiPropertyOptional({ example: 'agency.approve' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  @ApiPropertyOptional({ example: 'agency' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;
}
