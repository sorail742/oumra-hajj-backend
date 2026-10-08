import { Role } from '../common/enums/role.enum';

// Idée #62 (backlog "Cent Fonctionnalités") — médiation des litiges.

export const DISPUTE_CATEGORIES = [
  'payment',
  'refund',
  'accommodation',
  'transport',
  'documents',
  'service',
  'other',
] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export enum DisputeStatus {
  OPEN = 'open',
  AGENCY_RESPONDED = 'agency_responded',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export class DisputeMessageShape {
  id!: string;
  authorRole!: Role;
  authorName!: string;
  content!: string;
  createdAt!: Date;
}

export class DisputeShape {
  id!: string;
  bookingId!: string;
  packageTitle!: string;
  agencyId!: string;
  agencyName!: string;
  pilgrimName!: string;
  category!: DisputeCategory;
  subject!: string;
  status!: DisputeStatus;
  decision?: string;
  escalatedAt?: Date;
  closedAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
  // À partir de quand le pèlerin peut escalader sans réponse de l'agence.
  escalationAvailableAt!: Date;
  // Présents dans le détail seulement.
  messages?: DisputeMessageShape[];
}
