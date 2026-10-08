import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { EMERGENCY_CATEGORIES } from '../../../types/emergency.types';
import type { EmergencyCategory } from '../../../types/emergency.types';

export class CreateEmergencyNumberDto {
  @ApiProperty({ description: 'Intitulé affiché (ex. : « Police »)' })
  @IsString()
  @MinLength(2)
  label!: string;

  @ApiProperty({ enum: EMERGENCY_CATEGORIES })
  @IsIn(EMERGENCY_CATEGORIES)
  category!: EmergencyCategory;

  // Numéro court (911) ou international (+966…) : chiffres, espaces et +.
  @ApiProperty({ description: 'Numéro à composer' })
  @IsString()
  @Matches(/^\+?[0-9][0-9 ]{1,19}$/)
  phone!: string;

  @ApiProperty({ description: 'Pays, code ISO 3166-1 alpha-2 (SA, GN…)' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  country!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
