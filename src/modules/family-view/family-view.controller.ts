import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { FamilyViewShape } from '../../types/booking.types';
import { BookingsService } from '../bookings/bookings.service';

// Idée #28 (backlog "Cent Fonctionnalités") — consultation publique du lien
// de suivi familial. Non documenté dans Swagger : ce n'est pas une route de
// l'API cliente de la plateforme, même traitement que CalendarController
// (idée #70). Le jeton fait office d'autorisation — aucun en-tête
// Authorization n'est envoyé par un proche qui ouvre simplement le lien.
@ApiExcludeController()
@Controller('family-view')
export class FamilyViewController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Get(':token')
  getView(@Param('token') token: string): Promise<FamilyViewShape> {
    return this.bookingsService.getFamilyView(token);
  }
}
