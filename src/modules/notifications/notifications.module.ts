import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ConsolePushSender } from './senders/console-push-sender.service';
import { ConsoleSmsSender } from './senders/console-sms-sender.service';
import { PUSH_SENDER } from './senders/push-sender.interface';
import { SMS_SENDER } from './senders/sms-sender.interface';

@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: PUSH_SENDER, useClass: ConsolePushSender },
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
