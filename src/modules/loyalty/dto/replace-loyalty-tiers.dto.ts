import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoyaltyTierDto {
  @ApiProperty({ minimum: 1, maximum: 50, example: 2 })
  @IsInt()
  @Min(1)
  @Max(50)
  minTrips!: number;

  @ApiProperty({ example: 'Fidèle' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  // Avantage accordé par l'agence (chambre, transfert, priorité...) — pas
  // une remise appliquée automatiquement.
  @ApiProperty({ example: 'Transfert aéroport offert' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  benefit!: string;
}

export class ReplaceLoyaltyTiersDto {
  // Vide : l'agence n'a plus de programme de fidélité.
  @ApiProperty({ type: [LoyaltyTierDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LoyaltyTierDto)
  tiers!: LoyaltyTierDto[];
}
