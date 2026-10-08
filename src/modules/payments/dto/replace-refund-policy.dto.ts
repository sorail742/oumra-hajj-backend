import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RefundPolicyTierDto {
  @ApiProperty({ minimum: 0, maximum: 730, example: 30 })
  @IsInt()
  @Min(0)
  @Max(730)
  minDaysBeforeDeparture!: number;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  rate!: number;
}

export class ReplaceRefundPolicyDto {
  // Vide : retour au barème par défaut de la plateforme.
  @ApiProperty({ type: [RefundPolicyTierDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RefundPolicyTierDto)
  tiers!: RefundPolicyTierDto[];
}
