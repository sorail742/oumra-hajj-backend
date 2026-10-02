import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { maskEmail } from './mask-email';
import { OtpSender } from './otp-sender.interface';

export const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const DELAI_MAX_MS = 10_000;

// Envoi du code OTP par email via l'API REST d'EmailJS (ADR 0025).
// Authentifié par la clé privée (`accessToken`) : l'option « Use Private
// Key » doit être active sur le compte. Ni le code ni l'adresse complète ne
// sont journalisés.
@Injectable()
export class EmailJsOtpSender implements OtpSender {
  private readonly logger = new Logger(EmailJsOtpSender.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async send(email: string, code: string): Promise<void> {
    const { serviceId, templateId, publicKey, privateKey } =
      this.configService.get('emailjs', { infer: true });
    const { ttlSeconds } = this.configService.get('otp', { infer: true });

    let status: number;
    try {
      const response = await fetch(EMAILJS_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_email: email,
            otp_code: code,
            expires_in_minutes: Math.ceil(ttlSeconds / 60),
            app_name: 'Oumra & Hadj',
          },
        }),
        signal: AbortSignal.timeout(DELAI_MAX_MS),
      });
      status = response.status;
    } catch (error) {
      this.logger.error(
        `Envoi OTP vers ${maskEmail(email)} impossible : ${(error as Error).name}`,
      );
      throw new ServiceUnavailableException(
        "L'envoi du code par email est momentanément indisponible",
      );
    }

    if (status < 200 || status >= 300) {
      this.logger.error(
        `EmailJS a refusé l'envoi OTP vers ${maskEmail(email)} (HTTP ${status})`,
      );
      throw new ServiceUnavailableException(
        "L'envoi du code par email est momentanément indisponible",
      );
    }
  }
}
