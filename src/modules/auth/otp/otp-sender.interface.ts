export const OTP_SENDER = 'OTP_SENDER';

// Abstraction du provider SMS/OTP — le choix du fournisseur (Orange, MTN,
// agrégateur tiers) reste à confirmer, voir ADR 0006 (statut "proposé") et
// ADR 0009. Ne jamais implémenter d'appel réseau réel ici avant qu'un
// fournisseur soit retenu.
export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}
