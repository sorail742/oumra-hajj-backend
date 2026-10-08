import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

export class PaymentShape {
  id!: string;
  bookingId!: string;
  amount!: number;
  currency!: string;
  installmentNumber!: number;
  method!: PaymentMethod;
  status!: PaymentStatus;
  providerReference!: string;
  receiptRef?: string;
  confirmedAt?: Date;
  refundedAmount?: number;
  refundedAt?: Date;
}

export class SavingsPlanShape {
  id!: string;
  bookingId!: string;
  targetAmount!: number;
  autoDeduct!: boolean;
  deductAmount?: number;
  frequency?: string;
  nextDeductDate?: Date;
}

export class TreasuryProjectionItemShape {
  // Format : YYYY-MM
  month!: string;
  expectedAmount!: number;
}

export class TreasuryProjectionShape {
  totalExpected!: number;
  totalCollected!: number;
  outstandingBalance!: number;
  projections!: TreasuryProjectionItemShape[];
}

// Idée #57 (backlog "Cent Fonctionnalités") — export comptable.
export type AccountingJournal = 'ENC' | 'REM';

export class AccountingEntryShape {
  date!: Date;
  // ENC : encaissement (débit trésorerie) ; REM : remboursement (crédit).
  journal!: AccountingJournal;
  pieceRef!: string;
  label!: string;
  debit!: number;
  credit!: number;
  currency!: string;
  method!: PaymentMethod;
  providerReference!: string;
  bookingId!: string;
  installmentNumber!: number;
  pilgrimName!: string;
  packageTitle!: string;
}

export class AccountingExportShape {
  // Bornes incluses, format YYYY-MM-DD.
  from!: string;
  to!: string;
  currency!: string;
  totalCollected!: number;
  totalRefunded!: number;
  net!: number;
  entries!: AccountingEntryShape[];
}

// Idée #58 (backlog "Cent Fonctionnalités") — barème de remboursement.
export class RefundPolicyTierShape {
  // À partir de ce nombre de jours avant le départ…
  minDaysBeforeDeparture!: number;
  // …ce taux du paiement est remboursé (0 à 1).
  rate!: number;
}

export class RefundPolicyShape {
  agencyId!: string;
  // Vide : barème par défaut de la plateforme (100 % avant confirmation,
  // 50 % après).
  tiers!: RefundPolicyTierShape[];
}

export type RefundRule =
  | 'unpaid_booking'
  | 'agency_tier'
  | 'platform_default'
  | 'not_refundable';

export class RefundPreviewShape {
  paymentId!: string;
  eligibleRate!: number;
  refundableAmount!: number;
  currency!: string;
  rule!: RefundRule;
  daysBeforeDeparture!: number;
  // Barème appliqué : celui figé à la réservation, vide si défaut.
  tiers!: RefundPolicyTierShape[];
}
