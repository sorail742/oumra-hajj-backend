// Idée #63 (backlog "Cent Fonctionnalités") — astreinte 24/7.

export const ON_CALL_ROLES = [
  'guide',
  'coordinator',
  'manager',
  'other',
] as const;
export type OnCallRole = (typeof ON_CALL_ROLES)[number];

export class OnCallShiftShape {
  id!: string;
  // Absent : créneau valable pour tous les voyages de l'agence.
  packageId?: string;
  packageTitle?: string;
  staffName!: string;
  staffRole!: OnCallRole;
  phone!: string;
  startsAt!: Date;
  endsAt!: Date;
  notes?: string;
}

export class OnCallPeriodShape {
  from!: Date;
  to!: Date;
}

// Couverture d'un voyage : périodes du séjour sans personne d'astreinte.
export class OnCallCoverageShape {
  packageId!: string;
  packageTitle!: string;
  from!: Date;
  to!: Date;
  coveredHours!: number;
  totalHours!: number;
  gaps!: OnCallPeriodShape[];
}

// Contact d'astreinte vu du pèlerin : ni notes internes, ni rôle détaillé
// au-delà de ce qui aide à savoir qui appeler.
export class OnCallContactShape {
  staffName!: string;
  staffRole!: OnCallRole;
  phone!: string;
  startsAt!: Date;
  endsAt!: Date;
}

export class MyOnCallShape {
  bookingId!: string;
  agencyName!: string;
  // Numéro général de l'agence, en dernier recours.
  agencyPhone!: string;
  current!: OnCallContactShape[];
  next?: OnCallContactShape;
}
