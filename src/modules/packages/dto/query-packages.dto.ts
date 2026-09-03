import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PilgrimageType } from '../../../common/enums/pilgrimage-type.enum';

export class QueryPackagesDto {
  @ApiPropertyOptional({ enum: PilgrimageType })
  @IsOptional()
  @IsEnum(PilgrimageType)
  type?: PilgrimageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}
