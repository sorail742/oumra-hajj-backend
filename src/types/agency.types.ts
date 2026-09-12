import { AgencyValidationStatus } from '../common/enums/agency-validation-status.enum';

export interface LegalDocumentShape {
  label: string;
  storageRef: string;
  uploadedAt: Date;
}

export interface BankDetailsShape {
  accountName: string;
  accountNumber: string;
  bankName: string;
}

export interface AgencyShape {
  id: string;
  legalName: string;
  ownerId: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  legalDocuments: LegalDocumentShape[];
  validationStatus: AgencyValidationStatus;
  rejectionReason?: string;
  validatedById?: string;
  validatedAt?: Date;
  commissionRate: number;
  bankDetails?: BankDetailsShape;
}

// Idée #96 du backlog "Cent Fonctionnalités" : indicateur combiné lisible
// pour un pèlerin non expert. "Taux de litiges" évoqué dans le brainstorm
// n'a pas de module dédié aujourd'hui — remplacé par le taux de réservations
// menées à terme (COMPLETED / (COMPLETED + CANCELLED)), seul signal de
// fiabilité objectif déjà disponible en base.
export interface AgencyTrustScoreShape {
  agencyId: string;
  // undefined si aucune des deux données n'est disponible (agence toute
  // nouvelle) — jamais une valeur fabriquée pour combler l'absence de
  // données.
  score?: number; // 0-100
  reviewAverage?: number; // 0-5
  reviewCount: number;
  completionRate?: number; // 0-1
  concludedBookingsCount: number;
}
