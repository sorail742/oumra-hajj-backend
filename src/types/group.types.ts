export class ItineraryStepShape {
  label!: string;
  date!: Date;
  location?: string;
}

export class MemberLocationShape {
  userId!: string;
  // Nom du membre, pour le reconnaître sur la carte de suivi. Visible des
  // mêmes personnes que la position elle-même (membres, guide, agence,
  // administration — `GroupsService.findAuthorizedOrFail`).
  fullName!: string;
  lat!: number;
  lng!: number;
  updatedAt!: Date;
}

export class GroupShape {
  id!: string;
  packageId!: string;
  agencyId!: string;
  title!: string;
  guideId?: string;
  memberIds!: string[];
  itinerary!: ItineraryStepShape[];
  locations!: MemberLocationShape[];
}
