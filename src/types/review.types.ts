export interface ReviewShape {
  id: string;
  pilgrimId: string;
  agencyId: string;
  bookingId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}
