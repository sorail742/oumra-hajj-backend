import { BookingStatus } from '../common/enums/booking-status.enum';
import { DossierStepKey } from '../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../common/enums/dossier-step-status.enum';
import { PilgrimageType } from '../common/enums/pilgrimage-type.enum';

export interface TripSummaryStepShape {
  key: DossierStepKey;
  status: DossierStepStatus;
  completedAt?: Date;
}

export interface TripSummaryRiteShape {
  riteKey: string;
  // Absent si la fiche a été retirée/dépubliée depuis la progression.
  title?: string;
  completed: boolean;
  tawafCount: number;
  saiCount: number;
}

export interface TripSummaryReviewShape {
  rating: number;
  comment?: string;
}

// Idée #23 (backlog "Cent Fonctionnalités") : "Photos + étapes + Duas
// complétées" évoqué dans le brainstorm — pas de module photo/album ni de
// suivi individuel des Duas aujourd'hui (voir Parcours Pèlerin, écrans #16
// et #17 non construits), donc volontairement absents ici plutôt que
// simulés. Ce qui suit est ce qui existe réellement en base.
export interface TripSummaryShape {
  bookingId: string;
  status: BookingStatus;
  packageTitle: string;
  pilgrimageType: PilgrimageType;
  startDate: Date;
  endDate: Date;
  agencyName: string;
  steps: TripSummaryStepShape[];
  totalPaid: number;
  currency: string;
  installmentsCount: number;
  rites: TripSummaryRiteShape[];
  review?: TripSummaryReviewShape;
}
