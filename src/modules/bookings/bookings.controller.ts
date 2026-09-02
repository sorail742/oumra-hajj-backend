import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { BookingsService } from './bookings.service';
import { AssignGroupDto } from './dto/assign-group.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { BookingDocument } from './schemas/booking.schema';

@ApiBearerAuth()
@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Roles(Role.PILGRIM)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.create(user.sub, dto);
  }

  @Roles(Role.PILGRIM)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<BookingDocument[]> {
    return this.bookingsService.findMine(user.sub);
  }

  @Roles(Role.AGENCY)
  @Get('agency')
  listForAgency(@CurrentUser() user: JwtPayload): Promise<BookingDocument[]> {
    return this.bookingsService.findByAgency(user.sub);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<BookingDocument> {
    return this.bookingsService.findAuthorizedOrFail(user.sub, user.role, id);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/step')
  updateStep(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStepDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.updateStep(user.sub, id, dto);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/group')
  assignGroup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignGroupDto,
  ): Promise<BookingDocument> {
    return this.bookingsService.assignGroup(user.sub, id, dto.groupId);
  }

  @Roles(Role.PILGRIM)
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<BookingDocument> {
    return this.bookingsService.cancel(user.sub, id);
  }
}
