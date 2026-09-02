export interface ItineraryStepShape {
  label: string;
  date: Date;
  location?: string;
}

export interface MemberLocationShape {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: Date;
}

export interface GroupShape {
  id: string;
  packageId: string;
  agencyId: string;
  title: string;
  guideId?: string;
  memberIds: string[];
  itinerary: ItineraryStepShape[];
  locations: MemberLocationShape[];
}
