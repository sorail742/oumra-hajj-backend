import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QUOTE_CLIENT_TYPES } from '../../../types/quote.types';
import type { QuoteClientType } from '../../../types/quote.types';

export class QuoteLineDto {
  @ApiProperty({ example: 'Forfait Oumra — chambre quadruple' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1e12)
  unitPrice!: number;
}

// Totaux jamais fournis par le client : recalculés par le serveur.
export class CreateQuoteDto {
  @ApiPropertyOptional({ description: 'Forfait de référence (devise reprise)' })
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiProperty({ example: 'Mosquée de quartier (fictive)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clientName!: string;

  @ApiProperty({ enum: QUOTE_CLIENT_TYPES })
  @IsIn(QUOTE_CLIENT_TYPES)
  clientType!: QuoteClientType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiPropertyOptional({ example: '+224620000000' })
  @IsOptional()
  @IsPhoneNumber()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  pilgrimsCount!: number;

  @ApiPropertyOptional({
    description: 'Ignorée avec packageId',
    example: 'GNF',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiProperty({ type: [QuoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];

  @ApiPropertyOptional({ minimum: 0, maximum: 0.5, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(0.5)
  discountRate?: number;

  @ApiPropertyOptional({
    description: 'Conditions négociées (acompte, échéances...)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditions?: string;

  @ApiProperty({ description: 'Date limite de validité du devis' })
  @IsDateString()
  validUntil!: string;
}
