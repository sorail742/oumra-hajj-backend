import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { OtpSender } from './otp-sender.interface';
import { EmailJsSendError, sendEmailJs } from './send-emailjs';

export { EMAILJS_SEND_URL } from './send-emailjs';

// Envoi du code OTP par email via l'API REST d'EmailJS (ADR 0025). Ni le
// code ni l'adresse (donnée saisie) ne sont journalisés.
@Injectable()
export class EmailJsOtpSender implements OtpSender {
  private readonly logger = new Logger(EmailJsOtpSender.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async send(email: string, code: string): Promise<void> {
    const { templateId, ...credentials } = this.configService.get('emailjs', {
      infer: true,
    });
    const { ttlSeconds } = this.configService.get('otp', { infer: true });

    try {
      await sendEmailJs(credentials, templateId, {
        to_email: email,
        otp_code: code,
        expires_in_minutes: Math.ceil(ttlSeconds / 60),
        app_name: 'Oumra & Hadj',
      });
    } catch (error) {
      const detail =
        error instanceof EmailJsSendError ? error.detail : 'inconnue';
      this.logger.error(`Envoi OTP par email impossible (${detail})`);
      throw new ServiceUnavailableException(
        "L'envoi du code par email est momentanément indisponible",
      );
    }
  }
}
