import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty()
  @IsMongoId()
  packageId!: string;
}
