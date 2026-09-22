import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';
import { PilgrimageType } from '../../../common/enums/pilgrimage-type.enum';

// Idée #10 (backlog "Cent Fonctionnalités") : `maxBudget`, `familySize` et
// la fenêtre de dates permettent de passer d'une liste brute à filtrer
// soi-même à une recommandation qui tient compte de contraintes réelles du
// pèlerin (budget, dates possibles, composition familiale).
export class QueryPackagesDto {
  @ApiPropertyOptional({ enum: PilgrimageType })
  @IsOptional()
  @IsEnum(PilgrimageType)
  type?: PilgrimageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({
    description: 'Budget maximum, dans la devise du forfait',
  })
  @IsOptional()
  @IsPositive()
  maxBudget?: number;

  @ApiPropertyOptional({
    description:
      'Nombre de pèlerins du groupe — filtre sur les places restantes',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  familySize?: number;

  @ApiPropertyOptional({ description: 'Date de départ au plus tôt acceptable' })
  @IsOptional()
  @IsISO8601()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Date de départ au plus tard acceptable',
  })
  @IsOptional()
  @IsISO8601()
  startDateTo?: string;
}
