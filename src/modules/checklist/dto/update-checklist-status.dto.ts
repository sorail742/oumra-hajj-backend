import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateChecklistStatusDto {
  @ApiProperty({ description: 'Statut de la tâche' })
  @IsBoolean()
  isCompleted!: boolean;
}
