import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty()
  @IsUUID()
  packageId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;
}
