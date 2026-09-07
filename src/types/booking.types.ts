import { BookingStatus } from '../common/enums/booking-status.enum';
import { DossierStepKey } from '../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../common/enums/dossier-step-status.enum';

export interface DossierStepShape {
  key: DossierStepKey;
  status: DossierStepStatus;
  updatedAt: Date;
}

export interface BookingShape {
  id: string;
  pilgrimId: string;
  packageId: string;
  agencyId: string;
  groupId?: string;
  status: BookingStatus;
  steps: DossierStepShape[];
}
