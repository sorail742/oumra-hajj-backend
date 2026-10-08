import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { MyRoomShape, RoomBlockShape } from '../../types/room.types';
import { AssignRoomDto } from './dto/assign-room.dto';
import { CreateRoomBlockDto } from './dto/create-room-block.dto';
import { UpdateRoomBlockDto } from './dto/update-room-block.dto';
import { RoomsService } from './rooms.service';

// Idée #40 (backlog "Cent Fonctionnalités") — allotement de chambres.
@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Roles(Role.PILGRIM)
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload): Promise<MyRoomShape[]> {
    return this.roomsService.findMine(user.sub);
  }

  @Roles(Role.AGENCY)
  @ApiQuery({ name: 'packageId', required: false })
  @Get('blocks')
  listBlocks(
    @CurrentUser() user: JwtPayload,
    @Query('packageId', new ParseUUIDPipe({ optional: true }))
    packageId?: string,
  ): Promise<RoomBlockShape[]> {
    return this.roomsService.listBlocks(user.sub, packageId);
  }

  @Roles(Role.AGENCY)
  @Post('blocks')
  createBlock(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRoomBlockDto,
  ): Promise<RoomBlockShape> {
    return this.roomsService.createBlock(user.sub, dto);
  }

  @Roles(Role.AGENCY)
  @Get('blocks/:id')
  getBlock(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomBlockShape> {
    return this.roomsService.getBlock(user.sub, id);
  }

  @Roles(Role.AGENCY)
  @Patch('blocks/:id')
  updateBlock(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomBlockDto,
  ): Promise<RoomBlockShape> {
    return this.roomsService.updateBlock(user.sub, id, dto);
  }

  @Roles(Role.AGENCY)
  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBlock(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.roomsService.deleteBlock(user.sub, id);
  }

  // Place (ou déplace) une réservation dans une chambre du bloc.
  @Roles(Role.AGENCY)
  @Put('blocks/:id/assignments')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoomDto,
  ): Promise<RoomBlockShape> {
    return this.roomsService.assign(user.sub, id, dto);
  }

  @Roles(Role.AGENCY)
  @Delete('blocks/:id/assignments/:bookingId')
  unassign(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<RoomBlockShape> {
    return this.roomsService.unassign(user.sub, id, bookingId);
  }

  @Roles(Role.AGENCY)
  @Get('blocks/:id/rooming-list/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rooming-list.csv"')
  roomingList(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<string> {
    return this.roomsService.getRoomingListCsv(user.sub, id);
  }
}
