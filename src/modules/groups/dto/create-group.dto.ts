import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MinLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty()
  @IsMongoId()
  packageId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;
}
