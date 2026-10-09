// Idée #49 (backlog "Cent Fonctionnalités") — devis groupes et entreprises.

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export const QUOTE_CLIENT_TYPES = [
  'company',
  'mosque',
  'association',
  'other',
] as const;
export type QuoteClientType = (typeof QUOTE_CLIENT_TYPES)[number];

export class QuoteLineShape {
  label!: string;
  quantity!: number;
  unitPrice!: number;
  total!: number;
}

export class QuoteTotalsShape {
  currency!: string;
  lines!: QuoteLineShape[];
  subtotal!: number;
  discountRate!: number;
  discountAmount!: number;
  totalAmount!: number;
}

export class QuoteShape extends QuoteTotalsShape {
  id!: string;
  number!: string;
  packageId?: string;
  packageTitle?: string;
  clientName!: string;
  clientType!: QuoteClientType;
  contactName!: string;
  contactPhone?: string;
  contactEmail?: string;
  pilgrimsCount!: number;
  conditions?: string;
  validUntil!: Date;
  status!: QuoteStatus;
  // Envoyé et non répondu après `validUntil`.
  expired!: boolean;
  // Jeton du lien client, présent une fois le devis envoyé.
  shareToken?: string;
  sentAt?: Date;
  respondedAt?: Date;
  createdAt!: Date;
}

export class QuoteIssuerShape {
  name!: string;
  phone!: string;
  email!: string;
  address?: string;
}

// Vue du client par le lien : ni contacts saisis par l'agence, ni jeton.
export class SharedQuoteShape extends QuoteTotalsShape {
  number!: string;
  issuer!: QuoteIssuerShape;
  clientName!: string;
  packageTitle?: string;
  pilgrimsCount!: number;
  conditions?: string;
  validUntil!: Date;
  status!: QuoteStatus;
  expired!: boolean;
  respondedAt?: Date;
}
