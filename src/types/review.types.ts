export class ReviewShape {
  id!: string;
  pilgrimId!: string;
  agencyId!: string;
  bookingId!: string;
  rating!: number;
  comment?: string;
  createdAt!: Date;
}

// Idée #64 (backlog "Cent Fonctionnalités") : rapport destiné aux
// bailleurs/partenaires financiers de l'agence — pas d'identité pèlerin
// exposée (Review n'en porte déjà aucune, seulement `pilgrimId`).
export class RatingDistributionEntry {
  rating!: number;
  count!: number;
}

export class SatisfactionReportReview {
  rating!: number;
  comment?: string;
  createdAt!: Date;
}

export class SatisfactionReportShape {
  agencyId!: string;
  agencyName!: string;
  generatedAt!: Date;
  reviewCount!: number;
  reviewAverage?: number;
  ratingDistribution!: RatingDistributionEntry[];
  reviews!: SatisfactionReportReview[];
}
