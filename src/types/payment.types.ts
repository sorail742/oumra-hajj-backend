import {
  PaymentMethod,
  PaymentStatus,
} from '../modules/payments/schemas/payment.schema';

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
}
