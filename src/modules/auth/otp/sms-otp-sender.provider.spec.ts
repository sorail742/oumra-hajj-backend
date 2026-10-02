import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { ConsoleOtpSender } from './console-otp-sender.service';
import { chooseSmsOtpSender } from './sms-otp-sender.provider';
import { UnavailableSmsOtpSender } from './unavailable-sms-otp-sender.service';

function config(env: string): ConfigService<AppConfig, true> {
  return { get: () => env } as unknown as ConfigService<AppConfig, true>;
}

describe('chooseSmsOtpSender (ADR 0025 §4)', () => {
  it('refuse en production : aucun code SMS dans les journaux', async () => {
    const sender = chooseSmsOtpSender(config('production'));

    expect(sender).toBeInstanceOf(UnavailableSmsOtpSender);
    await expect(sender.send('+224620000000', '123456')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('journalise le code seulement hors production', () => {
    expect(chooseSmsOtpSender(config('development'))).toBeInstanceOf(
      ConsoleOtpSender,
    );
    expect(chooseSmsOtpSender(config('test'))).toBeInstanceOf(ConsoleOtpSender);
  });
});
