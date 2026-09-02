import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { NotificationsService } from './notifications.service';
import { NotificationDocument } from './schemas/notification.schema';

@ApiBearerAuth()
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<NotificationDocument[]> {
    return this.notificationsService.listForUser(
      user.sub,
      unreadOnly === 'true',
    );
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<NotificationDocument> {
    return this.notificationsService.markRead(user.sub, id);
  }
}
