import { PaymentMethod } from '../../../common/enums/payment-method.enum';

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentInitiationRequest {
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
}

export interface InitiatedPayment {
  providerReference: string;
}

// Abstraction du prestataire de paiement — voir ADR 0006. CinetPay retenu
// (validation du 2026-09-09) comme agrégateur Mobile Money, intégration
// réelle à brancher ici une fois le compte marchand et les identifiants
// disponibles. Le statut d'un paiement n'est jamais confirmé par cette
// interface : toujours par callback serveur-à-serveur
// (`PaymentsService.handleWebhook`), jamais fabriqué côté client — voir
// ADR 0006, "Point d'architecture".
export interface PaymentProvider {
  initiate(request: PaymentInitiationRequest): Promise<InitiatedPayment>;
}
