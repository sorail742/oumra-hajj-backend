import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CapacitySimulationShape } from '../../types/capacity.types';
import { CapacityService } from './capacity.service';
import { CapacitySimulationQueryDto } from './dto/capacity-simulation-query.dto';

// Idée #68 (backlog "Cent Fonctionnalités") — simulateur de capacité.
@ApiTags('capacity')
@ApiBearerAuth()
@Controller('capacity')
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Roles(Role.AGENCY)
  @Get('simulation')
  simulate(
    @CurrentUser() user: JwtPayload,
    @Query() query: CapacitySimulationQueryDto,
  ): Promise<CapacitySimulationShape> {
    return this.capacityService.simulate(user.sub, query);
  }
}
