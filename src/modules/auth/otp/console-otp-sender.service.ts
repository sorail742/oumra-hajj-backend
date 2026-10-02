import { Injectable, Logger } from '@nestjs/common';
import { OtpSender } from './otp-sender.interface';

// Développement et tests uniquement, tant qu'aucun fournisseur SMS n'est
// choisi (ADR 0009, ADR 0018) — jamais retenu en production, voir
// `sms-otp-sender.provider` (ADR 0025 §4).
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
