import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

export interface PaymentShape {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  installmentNumber: number;
  method: PaymentMethod;
  status: PaymentStatus;
  providerReference: string;
  receiptRef?: string;
  confirmedAt?: Date;
  refundedAmount?: number;
  refundedAt?: Date;
}

export interface SavingsPlanShape {
  id: string;
  bookingId: string;
  targetAmount: number;
  autoDeduct: boolean;
  deductAmount?: number;
  frequency?: string;
  nextDeductDate?: Date;
}

export interface TreasuryProjectionItemShape {
  month: string; // Format: YYYY-MM
  expectedAmount: number;
}

export interface TreasuryProjectionShape {
  totalExpected: number;
  totalCollected: number;
  outstandingBalance: number;
  projections: TreasuryProjectionItemShape[];
}
