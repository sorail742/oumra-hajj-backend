import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMicroCourseDto {
  @ApiProperty({ description: 'Titre du micro-cours' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @ApiProperty({ description: 'Description optionnelle', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL de la vidéo (hébergée sur stockage S3/CDN)',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  videoUrl!: string;

  @ApiProperty({
    description: 'Durée en secondes',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiProperty({
    description: "Ordre d'affichage",
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({
    description: 'Catégorie du cours (ex: preparation, rites, sante)',
    required: false,
    default: 'preparation',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
