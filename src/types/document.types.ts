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
}
