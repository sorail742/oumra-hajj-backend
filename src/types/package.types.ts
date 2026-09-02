import {
  PackageStatus,
  PilgrimageType,
} from '../modules/packages/schemas/package.schema';

export interface HotelInfoShape {
  name: string;
  city: string;
  distanceToMosqueMeters?: number;
}

export interface PackageShape {
  id: string;
  agencyId: string;
  type: PilgrimageType;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  price: number;
  currency: string;
  capacity: number;
  seatsTaken: number;
  hotel?: HotelInfoShape;
  inclusions: string[];
  status: PackageStatus;
}
