import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { SeasonComparisonShape } from '../../types/season.types';
import { SeasonComparisonQueryDto } from './dto/season-comparison-query.dto';
import { SeasonsService } from './seasons.service';

// Idée #65 (backlog "Cent Fonctionnalités") — comparatif inter-saisons.
@ApiTags('seasons')
@ApiBearerAuth()
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Roles(Role.AGENCY)
  @Get('comparison')
  compare(
    @CurrentUser() user: JwtPayload,
    @Query() query: SeasonComparisonQueryDto,
  ): Promise<SeasonComparisonShape> {
    return this.seasonsService.compare(user.sub, query);
  }
}
