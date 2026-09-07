import { AgencyValidationStatus } from '../common/enums/agency-validation-status.enum';
import { BookingStatus } from '../modules/bookings/schemas/booking.schema';

export interface PlatformStatsShape {
  totalPilgrims: number;
  totalGuides: number;
  agenciesByStatus: Record<AgencyValidationStatus, number>;
  bookingsByStatus: Record<BookingStatus, number>;
  totalRevenue: number;
}
