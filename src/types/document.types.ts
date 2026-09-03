import {
  PilgrimDocumentStatus,
  PilgrimDocumentType,
} from '../modules/documents/schemas/document.schema';

export interface PilgrimDocumentShape {
  id: string;
  bookingId: string;
  pilgrimId: string;
  type: PilgrimDocumentType;
  storageRef: string;
  status: PilgrimDocumentStatus;
  rejectionReason?: string;
}
