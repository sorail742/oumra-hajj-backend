import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { RiteSheetPilgrimageType } from '../../../common/enums/rite-sheet-pilgrimage-type.enum';

export class CreateRiteSheetDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ enum: RiteSheetPilgrimageType })
  @IsEnum(RiteSheetPilgrimageType)
  pilgrimageType!: RiteSheetPilgrimageType;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['fr', 'en', 'ar'])
  language?: string;
}
