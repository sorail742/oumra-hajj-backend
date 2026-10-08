import { PartialType } from '@nestjs/swagger';
import { CreateEmergencyNumberDto } from './create-emergency-number.dto';

export class UpdateEmergencyNumberDto extends PartialType(
  CreateEmergencyNumberDto,
) {}
