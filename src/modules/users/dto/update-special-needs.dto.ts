import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MOBILITY_LEVELS } from '../../../types/user.types';
import type { MobilityLevel } from '../../../types/user.types';

const LONGUEUR_MAX = 500;

// Remplacement complet (PUT) : un champ absent est effacé — le pèlerin
// retire ainsi une information qu'il ne veut plus partager.
export class UpdateSpecialNeedsDto {
  @ApiProperty({ enum: MOBILITY_LEVELS })
  @IsIn(MOBILITY_LEVELS)
  mobility!: MobilityLevel;

  @ApiProperty({ required: false, description: 'Régime alimentaire' })
  @IsOptional()
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  dietary?: string;

  @ApiProperty({
    required: false,
    description: 'Traitement, allergie, condition à connaître',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  medical?: string;

  @ApiProperty({ required: false, description: 'Accompagnement souhaité' })
  @IsOptional()
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  assistance?: string;
}
