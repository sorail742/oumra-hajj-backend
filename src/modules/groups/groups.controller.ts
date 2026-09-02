import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { AddItineraryStepDto } from './dto/add-itinerary-step.dto';
import { AssignGuideDto } from './dto/assign-guide.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { GroupsService } from './groups.service';
import { GroupDocument } from './schemas/group.schema';

@ApiBearerAuth()
@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Roles(Role.AGENCY)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupDocument> {
    return this.groupsService.create(user.sub, dto);
  }

  @Roles(Role.AGENCY)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<GroupDocument[]> {
    return this.groupsService.listByAgency(user.sub);
  }

  @Roles(Role.GUIDE)
  @Get('assigned')
  listAssigned(@CurrentUser() user: JwtPayload): Promise<GroupDocument[]> {
    return this.groupsService.listForGuide(user.sub);
  }

  @Roles(Role.PILGRIM)
  @Get('joined')
  listJoined(@CurrentUser() user: JwtPayload): Promise<GroupDocument[]> {
    return this.groupsService.listForPilgrim(user.sub);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<GroupDocument> {
    return this.groupsService.findAuthorizedOrFail(user.sub, user.role, id);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/guide')
  assignGuide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignGuideDto,
  ): Promise<GroupDocument> {
    return this.groupsService.assignGuide(user.sub, id, dto.guideUserId);
  }

  @Roles(Role.AGENCY)
  @Post(':id/itinerary')
  addItineraryStep(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddItineraryStepDto,
  ): Promise<GroupDocument> {
    return this.groupsService.addItineraryStep(user.sub, id, dto);
  }

  @Roles(Role.PILGRIM, Role.GUIDE)
  @Patch(':id/location')
  updateLocation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<GroupDocument> {
    return this.groupsService.updateLocation(user.sub, id, dto);
  }

  // Bouton SOS — cahier des charges §3.1.
  @Roles(Role.PILGRIM)
  @Post(':id/sos')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sos(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.groupsService.triggerSos(user.sub, id);
  }
}
