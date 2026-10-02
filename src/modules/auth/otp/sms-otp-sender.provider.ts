import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { ConsoleOtpSender } from './console-otp-sender.service';
import { OTP_SENDER, OtpSender } from './otp-sender.interface';
import { UnavailableSmsOtpSender } from './unavailable-sms-otp-sender.service';

// Canal SMS (ADR 0025 §4) : aucun fournisseur retenu (ADR 0009, ADR 0018).
// Hors production, le code est journalisé ; en production, refus (503) —
// jamais de code dans les journaux de production.
export function chooseSmsOtpSender(
  configService: ConfigService<AppConfig, true>,
): OtpSender {
  if (configService.get('env', { infer: true }) === 'production') {
    new Logger('SmsOtpSender').warn(
      'Aucun fournisseur SMS : la connexion par téléphone renverra 503 (ADR 0025).',
    );
    return new UnavailableSmsOtpSender();
  }
  return new ConsoleOtpSender();
}

export const smsOtpSenderProvider: Provider = {
  provide: OTP_SENDER,
  inject: [ConfigService],
  useFactory: chooseSmsOtpSender,
};
