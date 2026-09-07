import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MessagingChannel } from '../../common/enums/messaging-channel.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { ConversationShape, MessageShape } from '../../types';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

@ApiBearerAuth()
@ApiTags('messaging')
@Roles(Role.PILGRIM, Role.AGENCY, Role.GUIDE)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('bookings/:bookingId/conversations/:channel')
  getOrCreateConversation(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Param('channel', new ParseEnumPipe(MessagingChannel))
    channel: MessagingChannel,
  ): Promise<ConversationShape> {
    return this.messagingService.getOrCreateConversation(
      bookingId,
      channel,
      user.sub,
    );
  }

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') conversationId: string,
  ): Promise<MessageShape[]> {
    return this.messagingService.listMessages(conversationId, user.sub);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageShape> {
    return this.messagingService.sendMessage(conversationId, user.sub, dto);
  }
}
