import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OtpSender } from './otp-sender.interface';

// Production sans fournisseur SMS : refuse plutôt que de journaliser le
// code (ADR 0025 §4) — la connexion se fait par email en attendant.
@Injectable()
export class UnavailableSmsOtpSender implements OtpSender {
  send(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException(
        "L'envoi du code par SMS n'est pas encore disponible : utilisez votre adresse email",
      ),
    );
  }
}
