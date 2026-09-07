import { AgencyValidationStatus } from '../common/enums/agency-validation-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';

export interface PlatformStatsShape {
  totalPilgrims: number;
  totalGuides: number;
  agenciesByStatus: Record<AgencyValidationStatus, number>;
  bookingsByStatus: Record<BookingStatus, number>;
  totalRevenue: number;
}
