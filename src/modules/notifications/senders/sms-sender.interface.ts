export const SMS_SENDER = 'SMS_SENDER';

// SMS de secours pour les alertes critiques (SOS, changement de dernière
// minute) — voir ADR 0009. Fournisseur à mutualiser si possible avec le
// provider OTP de l'ADR 0003/0006, non choisi à ce stade.
export interface SmsSender {
  send(phone: string, content: string): Promise<void>;
}
