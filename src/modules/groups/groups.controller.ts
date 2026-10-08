import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { GroupRosterShape, GroupShape } from '../../types/group.types';
import { AddItineraryStepDto } from './dto/add-itinerary-step.dto';
import { AssignGuideDto } from './dto/assign-guide.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { GroupRosterService } from './group-roster.service';
import { GroupsService } from './groups.service';

@ApiBearerAuth()
@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly groupRosterService: GroupRosterService,
  ) {}

  @Roles(Role.AGENCY)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupShape> {
    return this.groupsService.create(user.sub, dto);
  }

  @Roles(Role.AGENCY)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<GroupShape[]> {
    return this.groupsService.listByAgency(user.sub);
  }

  @Roles(Role.GUIDE)
  @Get('assigned')
  listAssigned(@CurrentUser() user: JwtPayload): Promise<GroupShape[]> {
    return this.groupsService.listForGuide(user.sub);
  }

  @Roles(Role.PILGRIM)
  @Get('joined')
  listJoined(@CurrentUser() user: JwtPayload): Promise<GroupShape[]> {
    return this.groupsService.listForPilgrim(user.sub);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<GroupShape> {
    return this.groupsService.findAuthorizedOrFail(user.sub, user.role, id);
  }

  // Idée #41 — liste du groupe (agence propriétaire, guide du groupe).
  @Roles(Role.AGENCY, Role.GUIDE)
  @Get(':id/roster')
  getRoster(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<GroupRosterShape> {
    return this.groupRosterService.getRoster(user.sub, user.role, id);
  }

  @Roles(Role.AGENCY, Role.GUIDE)
  @Get(':id/roster/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="liste-groupe.csv"')
  getRosterCsv(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<string> {
    return this.groupRosterService.getRosterCsv(user.sub, user.role, id);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/guide')
  assignGuide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignGuideDto,
  ): Promise<GroupShape> {
    return this.groupsService.assignGuide(user.sub, id, dto.guideUserId);
  }

  @Roles(Role.AGENCY)
  @Post(':id/itinerary')
  addItineraryStep(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddItineraryStepDto,
  ): Promise<GroupShape> {
    return this.groupsService.addItineraryStep(user.sub, id, dto);
  }

  @Roles(Role.PILGRIM, Role.GUIDE)
  @Patch(':id/location')
  updateLocation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<GroupShape> {
    return this.groupsService.updateLocation(user.sub, id, dto);
  }

  // Arrêt du partage : efface la dernière position du demandeur (#85).
  @Roles(Role.PILGRIM, Role.GUIDE)
  @Delete(':id/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearLocation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.groupsService.clearLocation(user.sub, id);
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

  // Ticket #14 : "Je suis perdu" en un geste
  @Roles(Role.PILGRIM)
  @Post(':id/lost')
  @HttpCode(HttpStatus.NO_CONTENT)
  async lost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<void> {
    await this.groupsService.triggerLostAlert(user.sub, id, dto.lat, dto.lng);
  }
}
