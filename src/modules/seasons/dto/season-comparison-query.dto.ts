import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SeasonComparisonQueryDto {
  @ApiPropertyOptional({ description: 'Défaut : deux ans avant `toYear`' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  fromYear?: number;

  @ApiPropertyOptional({ description: 'Défaut : année en cours' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  toYear?: number;
}
