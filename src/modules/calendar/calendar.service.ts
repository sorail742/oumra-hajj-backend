import { Injectable } from '@nestjs/common';
import { PackageShape } from '../../types/package.types';
import { AgenciesService } from '../agencies/agencies.service';
import { PackagesService } from '../packages/packages.service';

const ICS_LINE_BREAK = '\r\n';
const CALENDAR_UID_DOMAIN = 'oumra-hadj-project.local';

// Échappement TEXT — RFC 5545 §3.3.11 : backslash, virgule et point-virgule
// doivent être précédés d'un backslash ; les retours à la ligne deviennent
// la séquence littérale `\n`.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function toIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function toIcsTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

// Un événement pleine journée par forfait — DTEND est exclusif en ICS
// (RFC 5545 §3.6.1), donc le lendemain de la date de fin réelle.
function toIcsEvent(pkg: PackageShape, dtstamp: string): string {
  const dtend = new Date(pkg.endDate);
  dtend.setUTCDate(dtend.getUTCDate() + 1);

  return [
    'BEGIN:VEVENT',
    `UID:${pkg.id}@${CALENDAR_UID_DOMAIN}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(pkg.startDate)}`,
    `DTEND;VALUE=DATE:${toIcsDate(dtend)}`,
    `SUMMARY:${escapeIcsText(pkg.title)}`,
    'END:VEVENT',
  ].join(ICS_LINE_BREAK);
}

// Idée #70 (backlog "Cent Fonctionnalités") : calendrier des échéances clés
// d'une agence (dates de départ/retour de tous ses forfaits, quel que soit
// leur statut), synchronisable Google/Outlook via une URL d'abonnement —
// voir AgenciesService.getOrCreateCalendarSubscription pour le jeton.
@Injectable()
export class CalendarService {
  constructor(
    private readonly agenciesService: AgenciesService,
    private readonly packagesService: PackagesService,
  ) {}

  async getAgencyFeed(token: string): Promise<string> {
    const agency = await this.agenciesService.findByCalendarTokenOrFail(token);
    const packages = await this.packagesService.findAllByAgencyId(agency.id);
    const dtstamp = toIcsTimestamp(new Date());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Oumra-Hadj Platform//Calendrier Agence//FR',
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${escapeIcsText(`Échéances clés — ${agency.legalName}`)}`,
      ...packages.map((pkg) => toIcsEvent(pkg, dtstamp)),
      'END:VCALENDAR',
    ].join(ICS_LINE_BREAK);
  }
}
