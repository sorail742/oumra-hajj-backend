import { Injectable } from '@nestjs/common';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { Role } from '../../common/enums/role.enum';
import { PaymentsService } from '../payments/payments.service';
import { UsersService } from '../users/users.service';
import { PlatformStatsDto } from './dto/platform-stats.dto';

// Statistiques globales de la plateforme — cahier des charges §3.4
// "Back-office Administrateur". Agrège les services métier existants plutôt
// que d'accéder directement à Mongoose (voir CLAUDE.md).
@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly agenciesService: AgenciesService,
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async getPlatformStats(): Promise<PlatformStatsDto> {
    const [pilgrims, guides, agenciesByStatus, bookingsByStatus, totalRevenue] =
      await Promise.all([
        this.usersService.findByRole(Role.PILGRIM),
        this.usersService.findByRole(Role.GUIDE),
        this.agenciesService.countByStatus(),
        this.bookingsService.countByStatus(),
        this.paymentsService.sumSucceededAmount(),
      ]);

    return {
      totalPilgrims: pilgrims.length,
      totalGuides: guides.length,
      agenciesByStatus,
      bookingsByStatus,
      totalRevenue,
    };
  }
}
