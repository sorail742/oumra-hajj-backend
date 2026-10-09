import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { ProfitabilitySimulationShape } from '../../types/profitability.types';
import { ProfitabilitySimulationDto } from './dto/profitability-simulation.dto';
import { ProfitabilityService } from './profitability.service';

// Idée #48 (backlog "Cent Fonctionnalités") — simulateur de rentabilité.
@ApiTags('profitability')
@ApiBearerAuth()
@Controller('profitability')
export class ProfitabilityController {
  constructor(private readonly profitabilityService: ProfitabilityService) {}

  // POST : les hypothèses de coûts sont une liste, rien n'est créé.
  @Roles(Role.AGENCY)
  @Post('simulation')
  @HttpCode(HttpStatus.OK)
  simulate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ProfitabilitySimulationDto,
  ): Promise<ProfitabilitySimulationShape> {
    return this.profitabilityService.simulate(user.sub, dto);
  }
}
