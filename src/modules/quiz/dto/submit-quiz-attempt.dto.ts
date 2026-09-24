import { IsInt, Min } from 'class-validator';

export class SubmitQuizAttemptDto {
  @IsInt()
  @Min(0)
  selectedOption!: number;
}
