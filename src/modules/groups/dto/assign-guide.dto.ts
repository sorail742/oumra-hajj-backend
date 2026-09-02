import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class AssignGuideDto {
  @ApiProperty()
  @IsMongoId()
  guideUserId!: string;
}
