import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { ConsoleEmailOtpSender } from './console-email-otp-sender.service';
import { EmailJsOtpSender } from './emailjs-otp-sender.service';
import { EMAIL_OTP_SENDER, OtpSender } from './otp-sender.interface';
import { UnavailableEmailOtpSender } from './unavailable-email-otp-sender.service';

// Choix du canal email au démarrage (ADR 0025 §4) : EmailJS s'il est
// entièrement configuré ; sinon journalisation hors production, refus en
// production.
export function chooseEmailOtpSender(
  configService: ConfigService<AppConfig, true>,
): OtpSender {
  const emailjs = configService.get('emailjs', { infer: true });
  const configured = Object.values(emailjs).every((value) => value !== '');
  if (configured) {
    return new EmailJsOtpSender(configService);
  }
  if (configService.get('env', { infer: true }) === 'production') {
    new Logger('EmailOtpSender').warn(
      'EmailJS non configuré : la connexion par email renverra 503 (ADR 0025).',
    );
    return new UnavailableEmailOtpSender();
  }
  return new ConsoleEmailOtpSender();
}

export const emailOtpSenderProvider: Provider = {
  provide: EMAIL_OTP_SENDER,
  inject: [ConfigService],
  useFactory: chooseEmailOtpSender,
};
