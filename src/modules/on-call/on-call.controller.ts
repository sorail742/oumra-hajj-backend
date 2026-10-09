import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import {
  MyOnCallShape,
  OnCallCoverageShape,
  OnCallShiftShape,
} from '../../types/on-call.types';
import { CreateOnCallShiftDto } from './dto/create-on-call-shift.dto';
import { ListOnCallShiftsQueryDto } from './dto/list-on-call-shifts-query.dto';
import { UpdateOnCallShiftDto } from './dto/update-on-call-shift.dto';
import { OnCallService } from './on-call.service';

// Idée #63 (backlog "Cent Fonctionnalités") — astreinte 24/7.
@ApiTags('on-call')
@ApiBearerAuth()
@Controller('on-call')
export class OnCallController {
  constructor(private readonly onCallService: OnCallService) {}

  @Roles(Role.PILGRIM)
  @Get('booking/:bookingId')
  findForBooking(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<MyOnCallShape> {
    return this.onCallService.getForBooking(user.sub, bookingId);
  }

  @Roles(Role.AGENCY)
  @Get('shifts')
  listShifts(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListOnCallShiftsQueryDto,
  ): Promise<OnCallShiftShape[]> {
    return this.onCallService.listShifts(user.sub, query);
  }

  @Roles(Role.AGENCY)
  @Post('shifts')
  createShift(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOnCallShiftDto,
  ): Promise<OnCallShiftShape> {
    return this.onCallService.createShift(user.sub, dto);
  }

  @Roles(Role.AGENCY)
  @Patch('shifts/:id')
  updateShift(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOnCallShiftDto,
  ): Promise<OnCallShiftShape> {
    return this.onCallService.updateShift(user.sub, id, dto);
  }

  @Roles(Role.AGENCY)
  @Delete('shifts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteShift(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.onCallService.deleteShift(user.sub, id);
  }

  @Roles(Role.AGENCY)
  @Get('coverage/:packageId')
  coverage(
    @CurrentUser() user: JwtPayload,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<OnCallCoverageShape> {
    return this.onCallService.getCoverage(user.sub, packageId);
  }
}
