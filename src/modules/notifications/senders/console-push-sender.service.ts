import { Injectable, Logger } from '@nestjs/common';
import { PushSender } from './push-sender.interface';

// Implémentation temporaire (journalisation locale) tant que FCM n'est pas
// intégré (voir ADR 0009). Ne jamais utiliser en production.
@Injectable()
export class ConsolePushSender implements PushSender {
  private readonly logger = new Logger(ConsolePushSender.name);

  send(
    userId: string,
    title: string,
    content: string,
  ): Promise<{ delivered: boolean }> {
    this.logger.log(`[PUSH DEV ONLY] -> ${userId} : ${title} — ${content}`);
    return Promise.resolve({ delivered: false });
  }
}
