import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OtpSender } from './otp-sender.interface';

// Production sans EmailJS configuré : refuse plutôt que de journaliser le
// code (ADR 0025 §4).
@Injectable()
export class UnavailableEmailOtpSender implements OtpSender {
  send(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException(
        "La connexion par email n'est pas encore disponible",
      ),
    );
  }
}
