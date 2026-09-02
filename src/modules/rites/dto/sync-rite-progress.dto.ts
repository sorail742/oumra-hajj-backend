import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class RiteProgressItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  riteKey!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  tawafCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  saiCount?: number;

  @ApiProperty()
  @IsDateString()
  clientUpdatedAt!: string;
}

// Synchronisation par lot depuis l'app mobile (offline-first) — voir ADR 0007.
export class SyncRiteProgressDto {
  @ApiProperty({ type: [RiteProgressItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RiteProgressItemDto)
  items!: RiteProgressItemDto[];
}
