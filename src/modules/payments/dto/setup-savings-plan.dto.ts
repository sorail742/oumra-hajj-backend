import { IsBoolean, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Seules fréquences que le planificateur sait faire avancer
// (`savings-scheduler.service.ts`) ; toute autre valeur désactivait le
// plan au premier passage.
export const SAVINGS_FREQUENCIES = ['weekly', 'monthly'] as const;

export class SetupSavingsPlanDto {
  @ApiPropertyOptional({ description: 'Montant à prélever à chaque itération' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  deductAmount?: number;

  @ApiPropertyOptional({
    description: 'Fréquence des cotisations',
    enum: SAVINGS_FREQUENCIES,
  })
  @IsOptional()
  @IsIn(SAVINGS_FREQUENCIES)
  frequency?: (typeof SAVINGS_FREQUENCIES)[number];

  @ApiProperty({
    description:
      'Activer ou désactiver les prélèvements automatiques / rappels',
  })
  @IsBoolean()
  autoDeduct!: boolean;
}
