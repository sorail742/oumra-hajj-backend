// Idée #48 (backlog "Cent Fonctionnalités") — simulateur de rentabilité.

export type ProfitabilityScenarioKind =
  'expected' | 'sold' | 'half' | 'three_quarters' | 'full';

export class ProfitabilityScenarioShape {
  kind!: ProfitabilityScenarioKind;
  pilgrims!: number;
  revenue!: number;
  platformCommission!: number;
  variableCosts!: number;
  fixedCosts!: number;
  margin!: number;
  // Marge rapportée au chiffre d'affaires (absente sans chiffre d'affaires).
  marginRate?: number;
  marginPerPilgrim?: number;
}

export class ProfitabilitySimulationShape {
  packageId?: string;
  packageTitle?: string;
  currency!: string;
  price!: number;
  capacity!: number;
  // Taux de la plateforme, fraction (0,05 = 5 %), lu côté serveur.
  commissionRate!: number;
  costPerPilgrim!: number;
  fixedCostsTotal!: number;
  // Ce que chaque pèlerin rapporte une fois commission et coûts déduits.
  unitContribution!: number;
  // Pèlerins nécessaires pour couvrir les frais fixes (absent : jamais).
  breakEvenPilgrims?: number;
  breakEvenReachable!: boolean;
  // Prix sans perte au remplissage attendu (absent : impossible).
  minimumPrice?: number;
  scenarios!: ProfitabilityScenarioShape[];
}
