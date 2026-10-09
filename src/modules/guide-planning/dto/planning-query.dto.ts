import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export class PlanningQueryDto {
  @ApiPropertyOptional({ description: "Début (défaut : aujourd'hui)" })
  @IsOptional()
  @Matches(DATE_JOUR, { message: 'from doit être au format AAAA-MM-JJ' })
  from?: string;

  @ApiPropertyOptional({ description: 'Fin incluse (défaut : dans un an)' })
  @IsOptional()
  @Matches(DATE_JOUR, { message: 'to doit être au format AAAA-MM-JJ' })
  to?: string;
}
