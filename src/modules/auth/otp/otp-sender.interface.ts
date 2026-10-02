export const OTP_SENDER = 'OTP_SENDER';
export const EMAIL_OTP_SENDER = 'EMAIL_OTP_SENDER';

// Abstraction d'un canal d'envoi du code OTP. Canal SMS (`OTP_SENDER`) :
// fournisseur encore à choisir (ADR 0009, ADR 0018). Canal email
// (`EMAIL_OTP_SENDER`) : EmailJS, voir ADR 0025. `destination` est un
// numéro E.164 ou une adresse email selon le canal.
export interface OtpSender {
  send(destination: string, code: string): Promise<void>;
}
