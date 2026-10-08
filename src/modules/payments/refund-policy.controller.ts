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
import { RefundPolicyShape } from '../../types/payment.types';
import { Audited } from '../audit/audited.decorator';
import { ReplaceRefundPolicyDto } from './dto/replace-refund-policy.dto';
import { RefundPolicyService } from './refund-policy.service';

// Idée #58 — barème de remboursement des agences.
@ApiTags('payments')
@Controller('refund-policies')
export class RefundPolicyController {
  constructor(private readonly refundPolicyService: RefundPolicyService) {}

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('mine')
  getMine(@CurrentUser() user: JwtPayload): Promise<RefundPolicyShape> {
    return this.refundPolicyService.getForOwner(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Put('mine')
  @Audited({
    action: 'refund_policy.update',
    entityType: 'agency',
    idField: 'agencyId',
    metadata: (r) => ({
      tiers: JSON.stringify((r as RefundPolicyShape).tiers),
    }),
  })
  replaceMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplaceRefundPolicyDto,
  ): Promise<RefundPolicyShape> {
    return this.refundPolicyService.replaceForOwner(user.sub, dto);
  }

  // Public : le pèlerin consulte le barème avant de réserver.
  @Public()
  @Get('agency/:agencyId')
  getForAgency(
    @Param('agencyId', ParseUUIDPipe) agencyId: string,
  ): Promise<RefundPolicyShape> {
    return this.refundPolicyService.getForAgency(agencyId);
  }
}
