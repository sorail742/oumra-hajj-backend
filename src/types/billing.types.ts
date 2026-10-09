import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RefundPolicyTierShape } from './payment.types';

// Idée #37 (backlog "Cent Fonctionnalités") — factures et contrats.

export class BillingPartyShape {
  name!: string;
  address?: string;
  email?: string;
  phone?: string;
  // Agence seulement : NIF et RCCM.
  taxId?: string;
  tradeRegister?: string;
}

export class InvoicePaymentShape {
  date!: Date;
  amount!: number;
  method!: PaymentMethod;
  status!: PaymentStatus;
  receiptRef?: string;
  refundedAmount?: number;
}

export class InvoiceShape {
  number!: string;
  issuedAt!: Date;
  bookingId!: string;
  seller!: BillingPartyShape;
  buyer!: BillingPartyShape;
  packageTitle!: string;
  packageType!: string;
  startDate!: Date;
  endDate!: Date;
  // Montant figé à l'émission.
  totalAmount!: number;
  currency!: string;
  payments!: InvoicePaymentShape[];
  paid!: number;
  refunded!: number;
  balanceDue!: number;
}

export class ContractStageShape {
  city!: string;
  hotelName!: string;
  distanceToMosqueMeters?: number;
  startDate!: Date;
  endDate!: Date;
}

export class ContractShape {
  bookingId!: string;
  generatedAt!: Date;
  bookedAt!: Date;
  agency!: BillingPartyShape;
  pilgrim!: BillingPartyShape;
  packageTitle!: string;
  packageType!: string;
  description?: string;
  startDate!: Date;
  endDate!: Date;
  stages!: ContractStageShape[];
  inclusions!: string[];
  price!: number;
  currency!: string;
  balanceDueDate!: Date;
  // Barème figé à la réservation ; vide : barème par défaut (50 % après
  // confirmation).
  refundTiers!: RefundPolicyTierShape[];
}
