import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CommunityMessageShape } from '../../types/community.types';
import { CommunityGateway } from './community.gateway';
import { CommunityService } from './community.service';
import { SendCommunityMessageDto } from './dto/send-community-message.dto';

@ApiTags('community')
@ApiBearerAuth()
@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly gateway: CommunityGateway,
  ) {}

  @Get('groups/:groupId/messages')
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
  ): Promise<CommunityMessageShape[]> {
    return this.communityService.listMessages(groupId, user);
  }

  @Post('groups/:groupId/messages')
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() dto: SendCommunityMessageDto,
  ): Promise<CommunityMessageShape> {
    const message = await this.communityService.sendMessage(groupId, user, dto);
    this.gateway.emitNewMessage(message);
    return message;
  }
}
