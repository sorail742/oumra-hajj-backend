import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignRoomDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  // Absent : première chambre du bloc qui a encore une place.
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  roomNumber?: number;
}
