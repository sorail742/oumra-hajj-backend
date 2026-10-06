export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  otp: {
    ttlSeconds: number;
    codeLength: number;
  };
  // Envoi du code OTP par email — ADR 0025. Vides tant que non configurés.
  emailjs: {
    serviceId: string;
    templateId: string;
    publicKey: string;
    privateKey: string;
  };
  // Réinitialisation du mot de passe agence / admin — ADR 0026.
  passwordReset: {
    ttlMinutes: number;
    webAppUrl: string;
    emailjsTemplateId: string;
  };
  // Temps réel (ADR 0027) : ticket WebSocket éphémère, à usage unique.
  realtime: {
    ticketSecret: string;
    ticketTtlSeconds: number;
    sessionMaxMinutes: number;
  };
  throttle: {
    ttlMs: number;
    limit: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://oumra_hadj:oumra_hadj_dev@localhost:5432/oumra_hadj_dev',
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
    codeLength: parseInt(process.env.OTP_CODE_LENGTH ?? '6', 10),
  },
  emailjs: {
    serviceId: process.env.EMAILJS_SERVICE_ID ?? '',
    templateId: process.env.EMAILJS_TEMPLATE_ID ?? '',
    publicKey: process.env.EMAILJS_PUBLIC_KEY ?? '',
    privateKey: process.env.EMAILJS_PRIVATE_KEY ?? '',
  },
  passwordReset: {
    ttlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '30', 10),
    webAppUrl: process.env.WEB_APP_URL ?? '',
    emailjsTemplateId: process.env.EMAILJS_RESET_TEMPLATE_ID ?? '',
  },
  realtime: {
    // Vide en production sans variable : temps réel désactivé (repli sur
    // le rafraîchissement périodique), jamais un secret connu de tous.
    ticketSecret:
      process.env.REALTIME_TICKET_SECRET ??
      (process.env.NODE_ENV === 'production'
        ? ''
        : 'dev-realtime-secret-change-me'),
    ticketTtlSeconds: 30,
    sessionMaxMinutes: 15,
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
