import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsInt,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateQuizQuestionDto {
  @IsString()
  @IsNotEmpty()
  riteSheetId!: string;

  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  correctOption!: number;

  @IsString()
  @IsOptional()
  explanation?: string;
}
