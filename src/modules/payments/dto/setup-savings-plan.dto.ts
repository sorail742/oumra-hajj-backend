import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetupSavingsPlanDto {
  @ApiPropertyOptional({ description: 'Montant à prélever à chaque itération' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductAmount?: number;

  @ApiPropertyOptional({ description: 'Fréquence de prélèvement (ex: weekly, monthly)' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiProperty({ description: 'Activer ou désactiver les prélèvements automatiques / rappels' })
  @IsBoolean()
  autoDeduct: boolean;
}
