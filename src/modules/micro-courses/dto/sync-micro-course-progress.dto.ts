import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MicroCourseProgressItemDto {
  @ApiProperty({ description: 'ID du micro-cours' })
  @IsString()
  @IsNotEmpty()
  courseId!: string;

  @ApiProperty({ description: 'Statut de complétion', required: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiProperty({
    description: "Horodatage client de l'action hors-ligne (ISO 8601)",
  })
  @IsDateString()
  clientUpdatedAt!: string;
}

// Synchronisation par lot depuis l'application mobile (offline-first) — voir ADR 0007.
export class SyncMicroCourseProgressDto {
  @ApiProperty({
    type: [MicroCourseProgressItemDto],
    description: 'Liste des progressions horodatées à synchroniser',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MicroCourseProgressItemDto)
  items!: MicroCourseProgressItemDto[];
}
