import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class AssignGroupDto {
  @ApiProperty()
  @IsMongoId()
  groupId!: string;
}
