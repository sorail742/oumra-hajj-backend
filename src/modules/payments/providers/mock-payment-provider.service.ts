import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  InitiatedPayment,
  PaymentInitiationRequest,
  PaymentProvider,
  RefundedPayment,
} from './payment-provider.interface';

// Implémentation temporaire tant que CinetPay (retenu, ADR 0006) n'est pas
// intégré : aucun compte marchand réel n'est contacté, la référence est
// fabriquée localement. Ne jamais utiliser en production — un paiement
// "confirmé" par cette implémentation ne l'est jamais réellement, seul
// `PaymentsService.handleWebhook` (callback serveur-à-serveur du vrai
// prestataire) fait foi.
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  initiate(request: PaymentInitiationRequest): Promise<InitiatedPayment> {
    const providerReference = `dev-${randomUUID()}`;
    this.logger.warn(
      `[PAIEMENT DEV ONLY] Initiation simulée pour la réservation ${request.bookingId} (${request.amount} ${request.currency}, ${request.method}) — référence ${providerReference}. Provider CinetPay réel non configuré (voir ADR 0006) ; statut confirmé uniquement via POST /payments/webhook.`,
    );
    return Promise.resolve({ providerReference });
  }

  refund(providerReference: string, amount: number): Promise<RefundedPayment> {
    const providerRefundReference = `dev-refund-${randomUUID()}`;
    this.logger.warn(
      `[PAIEMENT DEV ONLY] Remboursement simulé de ${amount} pour la référence ${providerReference} — référence ${providerRefundReference}. Provider CinetPay réel non configuré (voir ADR 0006).`,
    );
    return Promise.resolve({ providerRefundReference });
  }
}
