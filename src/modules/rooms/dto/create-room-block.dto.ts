import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ROOM_TYPES } from '../../../types/room.types';
import type { RoomType } from '../../../types/room.types';

export class CreateRoomBlockDto {
  @ApiProperty()
  @IsUUID()
  packageId!: string;

  // Étape du forfait (hôtel déjà renseigné) : son hôtel et sa ville sont
  // repris si `hotelName`/`city` ne sont pas fournis.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  hotelName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @ApiProperty({ enum: ROOM_TYPES })
  @IsIn(ROOM_TYPES)
  roomType!: RoomType;

  @ApiProperty({ minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  roomCount!: number;

  @ApiPropertyOptional({ description: 'Date limite de rétrocession à l’hôtel' })
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
