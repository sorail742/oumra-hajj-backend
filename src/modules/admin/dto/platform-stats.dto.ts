import { ApiProperty } from '@nestjs/swagger';

export class PlatformStatsDto {
  @ApiProperty()
  totalPilgrims!: number;

  @ApiProperty()
  totalGuides!: number;

  @ApiProperty()
  agenciesByStatus!: Record<string, number>;

  @ApiProperty()
  bookingsByStatus!: Record<string, number>;

  @ApiProperty()
  totalRevenue!: number;
}
