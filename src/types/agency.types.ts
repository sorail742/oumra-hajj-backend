import { AgencyValidationStatus } from '../modules/agencies/schemas/agency.schema';

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
