import { AgencyValidationStatus } from '../modules/agencies/schemas/agency.schema';
import { BookingStatus } from '../modules/bookings/schemas/booking.schema';

export interface PlatformStatsShape {
  totalPilgrims: number;
  totalGuides: number;
  agenciesByStatus: Record<AgencyValidationStatus, number>;
  bookingsByStatus: Record<BookingStatus, number>;
  totalRevenue: number;
}
