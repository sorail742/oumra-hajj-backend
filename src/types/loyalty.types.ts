// Idée #47 (backlog "Cent Fonctionnalités") — programme de fidélité.

export class LoyaltyTierShape {
  minTrips!: number;
  label!: string;
  benefit!: string;
}

export class LoyaltyProgramShape {
  agencyId!: string;
  agencyName!: string;
  // Paliers par nombre de voyages croissant ; vide : pas de programme.
  tiers!: LoyaltyTierShape[];
}

export class LoyaltyMemberShape {
  pilgrimId!: string;
  pilgrimName!: string;
  trips!: number;
  lastTripEnd!: Date;
  tier?: LoyaltyTierShape;
}

export class LoyaltyNextTierShape extends LoyaltyTierShape {
  tripsToGo!: number;
}

export class MyLoyaltyShape {
  agencyId!: string;
  agencyName!: string;
  trips!: number;
  tier?: LoyaltyTierShape;
  nextTier?: LoyaltyNextTierShape;
}
