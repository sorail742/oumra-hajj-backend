/**
 * Abstraction du prestataire de paiement — voir
 * docs/backend/paiements-djomy.md et docs/backend/adr/0005-*.md. Djomy
 * n'est implémenté nulle part encore : son contrat technique réel n'a pas
 * été vérifié (voir "Hypothèse à vérifier en premier" dans le document
 * ci-dessus). `MockPaymentProvider` permet de développer et tester le
 * reste de la plateforme sans en dépendre.
 */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentInitiationRequest {
  organizationId: string;
  amount: number;
  currency: 'GNF';
  purpose: 'rent' | 'deposit' | 'advance' | 'subscription';
  /** leaseId, rentScheduleId ou subscriptionId selon `purpose`. */
  referenceId: string;
}

export interface InitiatedPayment {
  providerReference: string;
  /** Présent si Djomy propose une redirection plutôt qu'un paiement in-app. */
  paymentUrl?: string;
}

export type PaymentProviderStatus = 'pending' | 'succeeded' | 'failed';

export interface PaymentProvider {
  initiate(request: PaymentInitiationRequest): Promise<InitiatedPayment>;

  /**
   * Réconciliation active — voir docs/backend/paiements-djomy.md
   * §"Le risque que le cahier des charges identifie lui-même". Appelée par
   * un job planifié pour les paiements restés `pending` au-delà d'un délai
   * raisonnable, en complément (jamais en remplacement) du webhook.
   */
  checkStatus(providerReference: string): Promise<PaymentProviderStatus>;
}
