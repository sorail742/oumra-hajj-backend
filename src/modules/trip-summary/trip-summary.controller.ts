import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { TripSummaryShape } from '../../types/trip-summary.types';
import { TripSummaryService } from './trip-summary.service';

// Idée #23 (backlog "Cent Fonctionnalités") — "livret souvenir". Le rendu
// imprimable/exportable est une responsabilité du client (mobile/web), pas
// de ce backend : cet endpoint fournit les données consolidées uniquement.
@ApiBearerAuth()
@ApiTags('trip-summary')
@Controller('trip-summary')
export class TripSummaryController {
  constructor(private readonly tripSummaryService: TripSummaryService) {}

  @Get(':bookingId')
  getForBooking(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
  ): Promise<TripSummaryShape> {
    return this.tripSummaryService.getForBooking(
      user.sub,
      user.role,
      bookingId,
    );
  }
}
