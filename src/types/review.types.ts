export interface ReviewShape {
  id: string;
  pilgrimId: string;
  agencyId: string;
  bookingId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

// Idée #64 (backlog "Cent Fonctionnalités") : rapport destiné aux
// bailleurs/partenaires financiers de l'agence — pas d'identité pèlerin
// exposée (Review n'en porte déjà aucune, seulement `pilgrimId`).
export interface RatingDistributionEntry {
  rating: number;
  count: number;
}

export interface SatisfactionReportShape {
  agencyId: string;
  agencyName: string;
  generatedAt: Date;
  reviewCount: number;
  reviewAverage?: number;
  ratingDistribution: RatingDistributionEntry[];
  reviews: Array<{ rating: number; comment?: string; createdAt: Date }>;
}
