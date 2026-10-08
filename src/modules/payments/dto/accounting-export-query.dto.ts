import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export class AccountingExportQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Début de période inclus (défaut : 1er du mois courant)',
  })
  @IsOptional()
  @Matches(DATE_JOUR, { message: 'from doit être au format AAAA-MM-JJ' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: "Fin de période incluse (défaut : aujourd'hui)",
  })
  @IsOptional()
  @Matches(DATE_JOUR, { message: 'to doit être au format AAAA-MM-JJ' })
  to?: string;
}
