import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CostLineDto {
  @ApiProperty({ example: 'Billet d’avion' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1e12)
  amount!: number;
}

// Hypothèses de l'agence : rien n'est enregistré. Avec `packageId`, prix,
// devise et capacité viennent du forfait, sauf si `price`/`capacity` sont
// fournis pour tester une autre valeur.
export class ProfitabilitySimulationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiPropertyOptional({ description: 'Requis sans packageId' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1e12)
  price?: number;

  @ApiPropertyOptional({
    description: 'Ignorée avec packageId',
    example: 'GNF',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ description: 'Requis sans packageId' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Défaut : la capacité' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  expectedPilgrims?: number;

  @ApiProperty({ type: [CostLineDto], description: 'Coûts par pèlerin' })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CostLineDto)
  costsPerPilgrim!: CostLineDto[];

  @ApiProperty({ type: [CostLineDto], description: 'Coûts fixes du voyage' })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CostLineDto)
  fixedCosts!: CostLineDto[];
}
