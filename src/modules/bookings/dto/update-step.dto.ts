import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DossierStepKey } from '../../../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../../../common/enums/dossier-step-status.enum';

export class UpdateStepDto {
  @ApiProperty({ enum: DossierStepKey })
  @IsEnum(DossierStepKey)
  key!: DossierStepKey;

  @ApiProperty({ enum: DossierStepStatus })
  @IsEnum(DossierStepStatus)
  status!: DossierStepStatus;
}
