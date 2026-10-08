// Idée #21 (backlog "Cent Fonctionnalités") — numéros d'urgence.

export const EMERGENCY_CATEGORIES = [
  'police',
  'medical',
  'civil_defense',
  'embassy',
  'other',
] as const;

export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export class EmergencyNumberShape {
  id!: string;
  label!: string;
  category!: EmergencyCategory;
  phone!: string;
  country!: string;
  city?: string;
  notes?: string;
  order!: number;
}

export class EmergencyAgencyContactShape {
  agencyId!: string;
  legalName!: string;
  phone!: string;
}

export class EmergencyGuideContactShape {
  groupId!: string;
  groupTitle!: string;
  fullName!: string;
  // Absent si le guide n'a pas de téléphone renseigné.
  phone?: string;
}

// Contacts personnels du pèlerin ou du guide, déduits de ses réservations
// et de ses groupes — jamais une liste générique.
export class MyEmergencyContactsShape {
  agencies!: EmergencyAgencyContactShape[];
  guides!: EmergencyGuideContactShape[];
}
