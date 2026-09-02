import { PartialType } from '@nestjs/swagger';
import { CreateRiteSheetDto } from './create-rite-sheet.dto';

export class UpdateRiteSheetDto extends PartialType(CreateRiteSheetDto) {}
