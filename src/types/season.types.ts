// Idée #65 (backlog "Cent Fonctionnalités") — archivage comparatif
// inter-saisons.

export class SeasonAmountShape {
  currency!: string;
  amount!: number;
}

// Une saison : une année de départ et un type de pèlerinage.
export class SeasonShape {
  year!: number;
  type!: string; // "oumra" | "hadj"
  packages!: number;
  capacity!: number;
  bookings!: number;
  cancellations!: number;
  // Réservations non annulées / capacité (absent sans capacité).
  fillRate?: number;
  cancellationRate?: number;
  averagePrice?: SeasonAmountShape[];
  // Encaissé net des remboursements, par devise.
  collected!: SeasonAmountShape[];
  reviews!: number;
  averageRating?: number;
  disputes!: number;
}

export class SeasonComparisonShape {
  fromYear!: number;
  toYear!: number;
  seasons!: SeasonShape[];
}
