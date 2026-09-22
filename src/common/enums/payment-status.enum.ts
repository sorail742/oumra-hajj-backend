export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  // Idée #58 (backlog "Cent Fonctionnalités") : remboursement selon un
  // barème clair (RefundPolicy), jamais une décision au cas par cas.
  REFUNDED = 'refunded',
}
