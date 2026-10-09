import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_PILGRIMS_PER_GUIDE } from '../../../types/capacity.types';

export class CapacitySimulationQueryDto {
  @ApiPropertyOptional({
    minimum: 5,
    maximum: 200,
    default: DEFAULT_PILGRIMS_PER_GUIDE,
    description: 'Pèlerins encadrés par guide — repère propre à l’agence',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(200)
  pilgrimsPerGuide?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 200,
    default: 0,
    description: 'Guides hypothétiques ajoutés (recrutement saisonnier)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  extraGuides?: number;
}
