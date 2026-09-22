import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PackageStatus } from '../../common/enums/package-status.enum';
import { PilgrimageType } from '../../common/enums/pilgrimage-type.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { PackagesService } from '../packages/packages.service';
import { CalendarService } from './calendar.service';

describe('CalendarService — flux ICS des échéances agence (idée #70)', () => {
  let service: CalendarService;
  let agenciesService: { findByCalendarTokenOrFail: jest.Mock };
  let packagesService: { findAllByAgencyId: jest.Mock };

  const buildPkg = (overrides: Partial<{ title: string }> = {}) => ({
    id: 'pkg-1',
    agencyId: 'agency-1',
    type: PilgrimageType.OUMRA,
    title: 'Oumra Ramadan',
    startDate: new Date('2027-03-01T00:00:00.000Z'),
    endDate: new Date('2027-03-15T00:00:00.000Z'),
    price: 500,
    currency: 'GNF',
    capacity: 10,
    seatsTaken: 0,
    stages: [],
    inclusions: [],
    status: PackageStatus.OPEN,
    ...overrides,
  });

  beforeEach(async () => {
    agenciesService = { findByCalendarTokenOrFail: jest.fn() };
    packagesService = { findAllByAgencyId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: AgenciesService, useValue: agenciesService },
        { provide: PackagesService, useValue: packagesService },
      ],
    }).compile();

    service = module.get(CalendarService);
  });

  it('rejette un jeton invalide sans interroger les forfaits', async () => {
    agenciesService.findByCalendarTokenOrFail.mockRejectedValue(
      new NotFoundException('Lien de calendrier invalide'),
    );

    await expect(
      service.getAgencyFeed('jeton-invalide'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(packagesService.findAllByAgencyId).not.toHaveBeenCalled();
  });

  it('génère un VCALENDAR valide avec un VEVENT par forfait', async () => {
    agenciesService.findByCalendarTokenOrFail.mockResolvedValue({
      id: 'agency-1',
      legalName: 'Agence Al-Amine',
    });
    packagesService.findAllByAgencyId.mockResolvedValue([buildPkg()]);

    const ics = await service.getAgencyFeed('un-jeton');
    const lines = ics.split('\r\n');

    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(
      lines.some(
        (l) => l.includes('Échéances clés') && l.includes('Agence Al-Amine'),
      ),
    ).toBe(true);
    expect(lines).toContain('UID:pkg-1@oumra-hadj-project.local');
    expect(lines).toContain('DTSTART;VALUE=DATE:20270301');
    // DTEND exclusif (RFC 5545) : lendemain de la date de fin réelle.
    expect(lines).toContain('DTEND;VALUE=DATE:20270316');
    expect(lines).toContain('SUMMARY:Oumra Ramadan');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
  });

  it('échappe les virgules et points-virgules dans le titre du forfait', async () => {
    agenciesService.findByCalendarTokenOrFail.mockResolvedValue({
      id: 'agency-1',
      legalName: 'Agence Al-Amine',
    });
    packagesService.findAllByAgencyId.mockResolvedValue([
      buildPkg({ title: 'Oumra, groupe A; départ anticipé' }),
    ]);

    const ics = await service.getAgencyFeed('un-jeton');

    expect(ics).toContain('SUMMARY:Oumra\\, groupe A\\; départ anticipé');
  });

  it('renvoie un calendrier vide (mais valide) si l’agence n’a aucun forfait', async () => {
    agenciesService.findByCalendarTokenOrFail.mockResolvedValue({
      id: 'agency-1',
      legalName: 'Agence Al-Amine',
    });
    packagesService.findAllByAgencyId.mockResolvedValue([]);

    const ics = await service.getAgencyFeed('un-jeton');

    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });
});
