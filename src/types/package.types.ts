import { PackageStatus } from '../common/enums/package-status.enum';
import { PilgrimageType } from '../common/enums/pilgrimage-type.enum';

// Une etape/hebergement du forfait (ex. Medine puis La Mecque) — un forfait
// en a toujours au moins une. Package.startDate/endDate restent les bornes
// globales du voyage, distinctes des dates propres a chaque etape.
export interface PackageStageShape {
  id: string;
  city: string;
  hotelName: string;
  distanceToMosqueMeters?: number;
  startDate: Date;
  endDate: Date;
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
  stages: PackageStageShape[];
  inclusions: string[];
  status: PackageStatus;
}
