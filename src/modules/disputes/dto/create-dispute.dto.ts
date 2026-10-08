import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DISPUTE_CATEGORIES } from '../../../types/dispute.types';
import type { DisputeCategory } from '../../../types/dispute.types';

export class CreateDisputeDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ enum: DISPUTE_CATEGORIES })
  @IsIn(DISPUTE_CATEGORIES)
  category!: DisputeCategory;

  @ApiProperty({ minLength: 5, maxLength: 140 })
  @IsString()
  @MinLength(5)
  @MaxLength(140)
  subject!: string;

  // Premier message : l'exposé du problème.
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
