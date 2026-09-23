import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { ChecklistService } from './checklist.service';
import { UpdateChecklistStatusDto } from './dto/update-checklist-status.dto';

@ApiTags('checklist')
@ApiBearerAuth()
@Controller('checklist')
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Roles(Role.PILGRIM)
  @Get('bookings/:bookingId')
  getByBooking(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
  ) {
    return this.checklistService.findByBookingId(user.sub, bookingId);
  }

  @Roles(Role.PILGRIM)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistStatusDto,
  ) {
    return this.checklistService.updateStatus(user.sub, id, dto);
  }
}

