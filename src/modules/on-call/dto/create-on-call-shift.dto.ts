import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ON_CALL_ROLES } from '../../../types/on-call.types';
import type { OnCallRole } from '../../../types/on-call.types';

export class CreateOnCallShiftDto {
  // Absent : créneau valable pour tous les voyages de l'agence.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  staffName!: string;

  @ApiProperty({ enum: ON_CALL_ROLES })
  @IsIn(ON_CALL_ROLES)
  staffRole!: OnCallRole;

  // Numéro professionnel joignable pendant le créneau.
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber()
  phone!: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({
    description: 'Consigne interne, non montrée au pèlerin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
