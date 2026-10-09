import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ON_CALL_ROLES } from '../../../types/on-call.types';
import type { OnCallRole } from '../../../types/on-call.types';

// Le forfait d'un créneau ne change pas : supprimer et recréer.
export class UpdateOnCallShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  staffName?: string;

  @ApiPropertyOptional({ enum: ON_CALL_ROLES })
  @IsOptional()
  @IsIn(ON_CALL_ROLES)
  staffRole?: OnCallRole;

  @ApiPropertyOptional({ example: '+224620000000' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
