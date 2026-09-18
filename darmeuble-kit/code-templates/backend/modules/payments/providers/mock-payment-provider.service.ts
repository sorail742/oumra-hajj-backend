import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  InitiatedPayment,
  PaymentInitiationRequest,
  PaymentProvider,
  PaymentProviderStatus,
} from './payment-provider.interface';

/**
 * Implémentation de développement — ne parle jamais réellement à Djomy.
 * Avertissement explicite "DEV ONLY", même convention que
 * `LocalDiskStorageProvider` d'Oumra-hadj-project. **Ne jamais déployer en
 * production** : `checkStatus` renvoie toujours `succeeded`, ce qui ne
 * teste aucun cas d'échec réel.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async initiate(
    request: PaymentInitiationRequest,
  ): Promise<InitiatedPayment> {
    const providerReference = `mock_${randomUUID()}`;
    this.logger.warn(
      `[PAIEMENT DEV ONLY] Paiement simulé — organisation=${request.organizationId} ` +
        `objet=${request.purpose} montant=${request.amount} ${request.currency} ` +
        `référence=${providerReference} — provider Djomy réel non configuré ` +
        `(voir docs/backend/paiements-djomy.md).`,
    );
    return { providerReference };
  }

  async checkStatus(
    providerReference: string,
  ): Promise<PaymentProviderStatus> {
    this.logger.warn(
      `[PAIEMENT DEV ONLY] Statut simulé "succeeded" pour ${providerReference}.`,
    );
    return 'succeeded';
  }
}
