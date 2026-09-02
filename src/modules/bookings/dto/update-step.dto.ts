import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DossierStepKey, DossierStepStatus } from '../schemas/booking.schema';

export class UpdateStepDto {
  @ApiProperty({ enum: DossierStepKey })
  @IsEnum(DossierStepKey)
  key!: DossierStepKey;

  @ApiProperty({ enum: DossierStepStatus })
  @IsEnum(DossierStepStatus)
  status!: DossierStepStatus;
}
