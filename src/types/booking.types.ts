import { BookingStatus } from '../common/enums/booking-status.enum';
import { DossierStepKey } from '../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../common/enums/dossier-step-status.enum';

export class DossierStepShape {
  key!: DossierStepKey;
  status!: DossierStepStatus;
  updatedAt!: Date;
}

export class BookingShape {
  id!: string;
  pilgrimId!: string;
  packageId!: string;
  agencyId!: string;
  groupId?: string;
  status!: BookingStatus;
  steps!: DossierStepShape[];
}

// Idée #28 (backlog "Cent Fonctionnalités") : lien d'abonnement en lecture
// seule, chemin relatif comme CalendarSubscriptionShape (idée #70) — le
// client compose avec sa propre base.
export class FamilyViewLinkShape {
  token!: string;
  viewUrl!: string;
}

export class FamilyViewLocation {
  lat!: number;
  lng!: number;
  updatedAt!: Date;
}

export class FamilyViewItineraryStep {
  label!: string;
  date!: Date;
  location?: string;
}

// Vue minimale, en lecture seule, destinée à un proche sans compte pèlerin.
// N'expose jamais les documents ni les paiements — seulement de quoi
// rassurer : où en est le dossier, où en est le voyage.
export class FamilyViewShape {
  pilgrimFullName!: string;
  packageTitle!: string;
  status!: BookingStatus;
  steps!: DossierStepShape[];
  // Absent si le pèlerin n'est rattaché à aucun groupe, ou n'a jamais
  // partagé sa position — jamais une position fabriquée.
  location?: FamilyViewLocation;
  latestItineraryStep?: FamilyViewItineraryStep;
}
