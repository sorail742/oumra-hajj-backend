import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { chooseEmailOtpSender } from './email-otp-sender.provider';
import { ConsoleEmailOtpSender } from './console-email-otp-sender.service';
import {
  EMAILJS_SEND_URL,
  EmailJsOtpSender,
} from './emailjs-otp-sender.service';
import { UnavailableEmailOtpSender } from './unavailable-email-otp-sender.service';

// Identifiants EmailJS explicitement factices (CLAUDE.md).
const EMAILJS_FACTICE = {
  serviceId: 'service_factice',
  templateId: 'template_factice',
  publicKey: 'cle-publique-factice',
  privateKey: 'cle-privee-factice',
};

function config(
  emailjs: AppConfig['emailjs'],
  env = 'production',
): ConfigService<AppConfig, true> {
  const values: Partial<AppConfig> = {
    env,
    emailjs,
    otp: { ttlSeconds: 300, codeLength: 6 },
  };
  return {
    get: (key: keyof AppConfig) => values[key],
  } as unknown as ConfigService<AppConfig, true>;
}

describe('EmailJsOtpSender', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock;
  });
  afterEach(() => fetchMock.mockReset());

  it("appelle l'API EmailJS authentifiée par la clé privée", async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    const sender = new EmailJsOtpSender(config(EMAILJS_FACTICE));

    await sender.send('pelerin@example.test', '123456');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(EMAILJS_SEND_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      service_id: 'service_factice',
      template_id: 'template_factice',
      user_id: 'cle-publique-factice',
      accessToken: 'cle-privee-factice',
      template_params: {
        to_email: 'pelerin@example.test',
        otp_code: '123456',
        expires_in_minutes: 5,
        app_name: 'Oumra & Hadj',
      },
    });
  });

  it('renvoie 503 si EmailJS refuse, sans exposer le code', async () => {
    fetchMock.mockResolvedValue({ status: 403 });
    const sender = new EmailJsOtpSender(config(EMAILJS_FACTICE));

    await expect(
      sender.send('pelerin@example.test', '123456'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('renvoie 503 si EmailJS est injoignable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const sender = new EmailJsOtpSender(config(EMAILJS_FACTICE));

    await expect(
      sender.send('pelerin@example.test', '123456'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('chooseEmailOtpSender', () => {
  const vide = { serviceId: '', templateId: '', publicKey: '', privateKey: '' };

  it('retient EmailJS quand les quatre variables sont renseignées', () => {
    expect(chooseEmailOtpSender(config(EMAILJS_FACTICE))).toBeInstanceOf(
      EmailJsOtpSender,
    );
  });

  it('refuse en production si EmailJS est incomplet — jamais de code journalisé', () => {
    expect(
      chooseEmailOtpSender(config({ ...EMAILJS_FACTICE, privateKey: '' })),
    ).toBeInstanceOf(UnavailableEmailOtpSender);
  });

  it('journalise le code seulement hors production', () => {
    expect(chooseEmailOtpSender(config(vide, 'development'))).toBeInstanceOf(
      ConsoleEmailOtpSender,
    );
  });
});
