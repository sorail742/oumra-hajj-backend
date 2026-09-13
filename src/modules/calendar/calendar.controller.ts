import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CalendarService } from './calendar.service';

// Non documenté dans Swagger : consommé par des clients calendrier
// (Google/Outlook), pas par l'API cliente de la plateforme — même
// traitement que LocalFilesController pour les documents (idée #70,
// backlog "Cent Fonctionnalités").
@ApiExcludeController()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // Le jeton fait office d'autorisation (URL d'abonnement secrète, non
  // expirante, révocable — voir AgenciesService.regenerateCalendarSubscription)
  // : aucun en-tête Authorization n'est envoyé par les clients calendrier.
  @Public()
  @Get('agency/:token/calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  getAgencyFeed(@Param('token') token: string): Promise<string> {
    return this.calendarService.getAgencyFeed(token);
  }
}
