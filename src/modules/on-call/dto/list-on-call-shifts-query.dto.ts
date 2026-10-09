import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ListOnCallShiftsQueryDto {
  // Créneaux de ce forfait et créneaux valables pour tous les voyages.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packageId?: string;

  // Créneaux qui se terminent après cette date (défaut : maintenant).
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
