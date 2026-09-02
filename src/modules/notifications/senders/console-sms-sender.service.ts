import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms-sender.interface';

// Implémentation temporaire (journalisation locale) tant que le fournisseur
// SMS n'est pas choisi (ADR 0006/0009). Ne jamais utiliser en production.
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger(ConsoleSmsSender.name);

  send(phone: string, content: string): Promise<void> {
    this.logger.warn(`[SMS DEV ONLY] -> ${phone} : ${content}`);
    return Promise.resolve();
  }
}
