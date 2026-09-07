import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PilgrimageType } from '../../../common/enums/pilgrimage-type.enum';

// Une etape/hebergement du forfait (ex. Medine puis La Mecque) — voir
// PackageStageShape.
export class PackageStageDto {
  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  hotelName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  distanceToMosqueMeters?: number;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;
}

export class CreatePackageDto {
  @ApiProperty({ enum: PilgrimageType })
  @IsEnum(PilgrimageType)
  type!: PilgrimageType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  capacity!: number;

  @ApiProperty({ type: [PackageStageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackageStageDto)
  stages!: PackageStageDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inclusions?: string[];
}
