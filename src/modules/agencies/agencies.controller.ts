import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { AgencyShape } from '../../types/agency.types';
import { AgenciesService } from './agencies.service';
import { RegisterAgencyDto } from './dto/register-agency.dto';
import { RejectAgencyDto } from './dto/reject-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

@ApiTags('agencies')
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterAgencyDto): Promise<AgencyShape> {
    return this.agenciesService.register(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('me')
  getOwn(@CurrentUser() user: JwtPayload): Promise<AgencyShape> {
    return this.agenciesService.findByOwnerOrFail(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Patch('me')
  updateOwn(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAgencyDto,
  ): Promise<AgencyShape> {
    return this.agenciesService.updateOwn(user.sub, dto);
  }

  // Validation des agences — cahier des charges §3.4.
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get()
  list(
    @Query('status') status?: AgencyValidationStatus,
  ): Promise<AgencyShape[]> {
    return this.agenciesService.findByStatus(status);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get(':id')
  getById(@Param('id') id: string): Promise<AgencyShape> {
    return this.agenciesService.findByIdOrFail(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ): Promise<AgencyShape> {
    return this.agenciesService.approve(id, admin.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: RejectAgencyDto,
  ): Promise<AgencyShape> {
    return this.agenciesService.reject(id, admin.sub, dto.reason);
  }
}
