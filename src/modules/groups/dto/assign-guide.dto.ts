import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignGuideDto {
  @ApiProperty()
  @IsUUID()
  guideUserId!: string;
}
