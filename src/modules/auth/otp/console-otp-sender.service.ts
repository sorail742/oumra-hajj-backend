import { Injectable, Logger } from '@nestjs/common';
import { OtpSender } from './otp-sender.interface';

// Implémentation temporaire (journalisation locale uniquement) tant que le
// fournisseur SMS/OTP n'est pas choisi (ADR 0006, ADR 0009). À remplacer par
// un provider réel avant la phase 5 (intégrations & tests) — ne jamais
// utiliser cette implémentation en production.
@Injectable()
export class ConsoleOtpSender implements OtpSender {
  private readonly logger = new Logger(ConsoleOtpSender.name);

  send(phone: string, code: string): Promise<void> {
    this.logger.warn(
      `[OTP DEV ONLY] Code ${code} pour ${phone} — provider SMS réel non configuré (voir ADR 0006/0009).`,
    );
    return Promise.resolve();
  }
}
