import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUnavailabilityDto {
  @ApiProperty()
  @IsUUID()
  guideId!: string;

  @ApiProperty({ example: '2026-11-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-11-10', description: 'Incluse' })
  @IsDateString()
  endDate!: string;

  // Motif court (« Congé ») — jamais de détail médical.
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reason?: string;
}
