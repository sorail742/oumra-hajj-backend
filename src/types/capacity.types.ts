// Idée #68 (backlog "Cent Fonctionnalités") — simulateur de capacité.

// Repère par défaut, à ajuster par l'agence : pas une norme réglementaire.
export const DEFAULT_PILGRIMS_PER_GUIDE = 40;

export class CapacityTripShape {
  packageId!: string;
  title!: string;
  startDate!: Date;
  endDate!: Date;
  capacity!: number;
  seatsTaken!: number;
  // Guides nécessaires pour la capacité du forfait au ratio choisi.
  guidesNeeded!: number;
  // Guides distincts déjà assignés aux groupes du forfait.
  guidesAssigned!: number;
}

// Période où le même ensemble de voyages est en cours.
export class CapacityPeriodShape {
  from!: Date;
  to!: Date;
  packageIds!: string[];
  plannedPilgrims!: number;
  soldPilgrims!: number;
  // Un guide n'encadre qu'un voyage à la fois : somme par voyage.
  guidesNeeded!: number;
  guidesNeededForSold!: number;
}

export class CapacitySimulationShape {
  pilgrimsPerGuide!: number;
  guides!: number;
  extraGuides!: number;
  staff!: number;
  trips!: CapacityTripShape[];
  periods!: CapacityPeriodShape[];
  // Période la plus exigeante en guides (absente sans voyage à venir).
  peak?: CapacityPeriodShape;
  // Guides restants au pic (négatif : il en manque).
  spareGuidesAtPeak!: number;
  // Pèlerins de plus encadrables au pic, sur un voyage de plus.
  extraPilgrimsAtPeak!: number;
}
