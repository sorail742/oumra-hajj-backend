import {
  BookingStatus,
  DossierStepKey,
  DossierStepStatus,
} from '../modules/bookings/schemas/booking.schema';

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
