import {
  Body,
  Controller,
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
import { DisputeShape } from '../../types/dispute.types';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeDecisionDto } from './dto/dispute-decision.dto';
import { DisputeMessageDto } from './dto/dispute-message.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { DisputesService } from './disputes.service';
import { Audited } from '../audit/audited.decorator';

// Idée #62 (backlog "Cent Fonctionnalités") — médiation des litiges.
@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Roles(Role.PILGRIM)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDisputeDto,
  ): Promise<DisputeShape> {
    return this.disputesService.create(user.sub, dto);
  }

  @Roles(Role.PILGRIM, Role.AGENCY, Role.ADMIN)
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListDisputesQueryDto,
  ): Promise<DisputeShape[]> {
    return this.disputesService.list(user.sub, user.role, query);
  }

  @Roles(Role.PILGRIM, Role.AGENCY, Role.ADMIN)
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DisputeShape> {
    return this.disputesService.findOne(user.sub, user.role, id);
  }

  @Roles(Role.PILGRIM, Role.AGENCY, Role.ADMIN)
  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeMessageDto,
  ): Promise<DisputeShape> {
    return this.disputesService.addMessage(
      user.sub,
      user.role,
      id,
      dto.content,
    );
  }

  @Roles(Role.PILGRIM)
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DisputeShape> {
    return this.disputesService.resolve(user.sub, id);
  }

  @Roles(Role.PILGRIM)
  @Audited({ action: 'dispute.escalate', entityType: 'dispute' })
  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK)
  escalate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DisputeShape> {
    return this.disputesService.escalate(user.sub, id);
  }

  @Roles(Role.ADMIN)
  @Audited({ action: 'dispute.decide', entityType: 'dispute' })
  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeDecisionDto,
  ): Promise<DisputeShape> {
    return this.disputesService.decide(user.sub, id, dto.decision);
  }
}
