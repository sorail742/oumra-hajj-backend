import { PilgrimDocumentStatus } from '../common/enums/pilgrim-document-status.enum';
import { PilgrimDocumentType } from '../common/enums/pilgrim-document-type.enum';

export interface PilgrimDocumentShape {
  id: string;
  bookingId: string;
  pilgrimId: string;
  type: PilgrimDocumentType;
  storageRef: string;
  status: PilgrimDocumentStatus;
  rejectionReason?: string;
  expiresAt?: Date;
}

// Idée #59 (backlog "Cent Fonctionnalités") : croise la date d'expiration
// déclarée par le pèlerin avec les dates réelles du voyage — jamais une
// alerte pour un document sans date d'expiration connue.
export type DocumentExpiryStatus =
  | 'expired'
  | 'expires_before_trip'
  | 'expires_soon_after_trip';

export interface DocumentExpiryAlertShape {
  id: string;
  type: PilgrimDocumentType;
  expiresAt: Date;
  status: DocumentExpiryStatus;
}
