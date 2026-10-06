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
