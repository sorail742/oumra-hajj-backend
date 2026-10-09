import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import {
  LoyaltyMemberShape,
  LoyaltyProgramShape,
  MyLoyaltyShape,
} from '../../types/loyalty.types';
import { Audited } from '../audit/audited.decorator';
import { ReplaceLoyaltyTiersDto } from './dto/replace-loyalty-tiers.dto';
import { LoyaltyService } from './loyalty.service';

// Idée #47 (backlog "Cent Fonctionnalités") — programme de fidélité.
@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Get('mine')
  getMine(@CurrentUser() user: JwtPayload): Promise<MyLoyaltyShape[]> {
    return this.loyaltyService.getMine(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('program/mine')
  getOwnProgram(@CurrentUser() user: JwtPayload): Promise<LoyaltyProgramShape> {
    return this.loyaltyService.getOwnProgram(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Put('program/mine')
  @Audited({
    action: 'loyalty_program.update',
    entityType: 'agency',
    idField: 'agencyId',
    metadata: (r) => ({
      tiers: (r as LoyaltyProgramShape).tiers.length,
    }),
  })
  replaceOwnTiers(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplaceLoyaltyTiersDto,
  ): Promise<LoyaltyProgramShape> {
    return this.loyaltyService.replaceOwnTiers(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('members')
  listMembers(@CurrentUser() user: JwtPayload): Promise<LoyaltyMemberShape[]> {
    return this.loyaltyService.listMembers(user.sub);
  }

  // Public : le pèlerin découvre le programme avant de réserver.
  @Public()
  @Get('program/agency/:agencyId')
  getProgram(
    @Param('agencyId', ParseUUIDPipe) agencyId: string,
  ): Promise<LoyaltyProgramShape> {
    return this.loyaltyService.getProgram(agencyId);
  }
}
