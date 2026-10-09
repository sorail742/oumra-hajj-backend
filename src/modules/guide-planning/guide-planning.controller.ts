import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { GuideScheduleShape } from '../../types/guide-planning.types';
import { Audited } from '../audit/audited.decorator';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';
import { PlanningQueryDto } from './dto/planning-query.dto';
import { GuidePlanningService } from './guide-planning.service';

// Idée #42 — planning des guides et Mutawif.
@ApiTags('guide-planning')
@ApiBearerAuth()
@Controller('guide-planning')
export class GuidePlanningController {
  constructor(private readonly guidePlanningService: GuidePlanningService) {}

  @Roles(Role.AGENCY)
  @Get()
  getAgencySchedule(
    @CurrentUser() user: JwtPayload,
    @Query() query: PlanningQueryDto,
  ): Promise<GuideScheduleShape[]> {
    return this.guidePlanningService.getAgencySchedule(user.sub, query);
  }

  @Roles(Role.GUIDE)
  @Get('mine')
  getMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: PlanningQueryDto,
  ): Promise<GuideScheduleShape> {
    return this.guidePlanningService.getMine(user.sub, query);
  }

  @Roles(Role.AGENCY)
  @Post('unavailabilities')
  @Audited({
    action: 'guide.unavailability_add',
    entityType: 'user',
    idField: 'guideId',
  })
  addUnavailability(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUnavailabilityDto,
  ): Promise<GuideScheduleShape> {
    return this.guidePlanningService.addUnavailability(user.sub, dto);
  }

  @Roles(Role.AGENCY)
  @Delete('unavailabilities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited({
    action: 'guide.unavailability_delete',
    entityType: 'guide_unavailability',
  })
  deleteUnavailability(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.guidePlanningService.deleteUnavailability(user.sub, id);
  }
}
