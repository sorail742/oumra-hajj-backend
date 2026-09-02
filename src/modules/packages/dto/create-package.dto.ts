import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PilgrimageType } from '../schemas/package.schema';

class HotelInfoDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  distanceToMosqueMeters?: number;
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

  @ApiPropertyOptional({ type: HotelInfoDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HotelInfoDto)
  hotel?: HotelInfoDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inclusions?: string[];
}
