// Idée #42 (backlog "Cent Fonctionnalités") — planning des guides.

export type PlanningEntryKind = 'group' | 'unavailability';

export class PlanningEntryShape {
  kind!: PlanningEntryKind;
  // Groupe ou indisponibilité.
  id!: string;
  label!: string;
  // Groupe seulement.
  packageTitle?: string;
  startDate!: Date;
  endDate!: Date;
}

export class PlanningConflictShape {
  firstId!: string;
  secondId!: string;
  // Jours communs, bornes incluses.
  startDate!: Date;
  endDate!: Date;
}

export class GuideScheduleShape {
  guideId!: string;
  guideName!: string;
  entries!: PlanningEntryShape[];
  conflicts!: PlanningConflictShape[];
}
