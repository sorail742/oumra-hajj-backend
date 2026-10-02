import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { sendEmailJs } from '../otp/send-emailjs';

export const PASSWORD_RESET_MAILER = 'PASSWORD_RESET_MAILER';

// Canal d'envoi du lien de réinitialisation (ADR 0026). `available` faux :
// la demande est refusée (503) avant toute recherche de compte.
export interface PasswordResetMailer {
  readonly available: boolean;
  send(email: string, resetUrl: string, ttlMinutes: number): Promise<void>;
}

class EmailJsPasswordResetMailer implements PasswordResetMailer {
  readonly available = true;

  constructor(
    private readonly emailjs: AppConfig['emailjs'],
    private readonly templateId: string,
  ) {}

  send(email: string, resetUrl: string, ttlMinutes: number): Promise<void> {
    return sendEmailJs(this.emailjs, this.templateId, {
      to_email: email,
      reset_url: resetUrl,
      expires_in_minutes: ttlMinutes,
      app_name: 'Oumra & Hadj',
    });
  }
}

// Développement et tests uniquement — jamais choisi en production.
class ConsolePasswordResetMailer implements PasswordResetMailer {
  readonly available = true;
  private readonly logger = new Logger('PasswordResetMailer');

  send(_email: string, resetUrl: string): Promise<void> {
    this.logger.warn(
      `[RESET DEV ONLY] Lien de réinitialisation : ${resetUrl} — EmailJS non configuré (ADR 0026).`,
    );
    return Promise.resolve();
  }
}

class UnavailablePasswordResetMailer implements PasswordResetMailer {
  readonly available = false;

  send(): Promise<void> {
    return Promise.reject(new Error('Réinitialisation indisponible'));
  }
}

export function choosePasswordResetMailer(
  configService: ConfigService<AppConfig, true>,
): PasswordResetMailer {
  const emailjs = configService.get('emailjs', { infer: true });
  const { emailjsTemplateId, webAppUrl } = configService.get('passwordReset', {
    infer: true,
  });
  const configured =
    [emailjs.serviceId, emailjs.publicKey, emailjs.privateKey].every(
      (value) => value !== '',
    ) &&
    emailjsTemplateId !== '' &&
    webAppUrl !== '';
  if (configured) {
    return new EmailJsPasswordResetMailer(emailjs, emailjsTemplateId);
  }
  if (configService.get('env', { infer: true }) === 'production') {
    new Logger('PasswordResetMailer').warn(
      'EmailJS ou WEB_APP_URL non configuré : « mot de passe oublié » renverra 503 (ADR 0026).',
    );
    return new UnavailablePasswordResetMailer();
  }
  return new ConsolePasswordResetMailer();
}

export const passwordResetMailerProvider: Provider = {
  provide: PASSWORD_RESET_MAILER,
  inject: [ConfigService],
  useFactory: choosePasswordResetMailer,
};
