import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import {
  EmergencyNumberShape,
  MyEmergencyContactsShape,
} from '../../types/emergency.types';
import { CreateEmergencyNumberDto } from './dto/create-emergency-number.dto';
import { UpdateEmergencyNumberDto } from './dto/update-emergency-number.dto';
import { EmergencyService } from './emergency.service';
import { Audited } from '../audit/audited.decorator';

@ApiTags('emergency')
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // Public : aucun numéro personnel dans l'annuaire, et il doit rester
  // consultable même sans session (téléphone d'un proche, session expirée).
  @Public()
  @Get('numbers')
  listNumbers(): Promise<EmergencyNumberShape[]> {
    return this.emergencyService.listNumbers();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Audited({
    action: 'emergency_number.create',
    entityType: 'emergency_number',
  })
  @Post('numbers')
  createNumber(
    @Body() dto: CreateEmergencyNumberDto,
  ): Promise<EmergencyNumberShape> {
    return this.emergencyService.createNumber(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Audited({
    action: 'emergency_number.update',
    entityType: 'emergency_number',
  })
  @Patch('numbers/:id')
  updateNumber(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyNumberDto,
  ): Promise<EmergencyNumberShape> {
    return this.emergencyService.updateNumber(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Audited({
    action: 'emergency_number.delete',
    entityType: 'emergency_number',
  })
  @Delete('numbers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNumber(@Param('id') id: string): Promise<void> {
    return this.emergencyService.deleteNumber(id);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM, Role.GUIDE)
  @Get('contacts/mine')
  findMyContacts(
    @CurrentUser() user: JwtPayload,
  ): Promise<MyEmergencyContactsShape> {
    return this.emergencyService.findMyContacts(user.sub);
  }
}
