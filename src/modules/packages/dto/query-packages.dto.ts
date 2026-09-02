import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PilgrimageType } from '../schemas/package.schema';

export class QueryPackagesDto {
  @ApiPropertyOptional({ enum: PilgrimageType })
  @IsOptional()
  @IsEnum(PilgrimageType)
  type?: PilgrimageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  agencyId?: string;
}
