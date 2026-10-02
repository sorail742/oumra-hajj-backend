import { Injectable, Logger } from '@nestjs/common';
import { OtpSender } from './otp-sender.interface';

// Développement et tests uniquement, quand EmailJS n'est pas configuré
// (ADR 0025 §4) — jamais choisi en production (voir `email-otp-sender.provider`).
@Injectable()
export class ConsoleEmailOtpSender implements OtpSender {
  private readonly logger = new Logger(ConsoleEmailOtpSender.name);

  send(email: string, code: string): Promise<void> {
    this.logger.warn(
      `[OTP EMAIL DEV ONLY] Code ${code} pour ${email} — EmailJS non configuré (ADR 0025).`,
    );
    return Promise.resolve();
  }
}
