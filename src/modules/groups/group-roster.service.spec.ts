import { ForbiddenException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { celluleCsv, GroupRosterService } from './group-roster.service';
import { GroupsService } from './groups.service';

describe('GroupRosterService — listes de groupe (idée #41)', () => {
  let service: GroupRosterService;
  const prisma = {
    user: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };
  const groupsService = { findByIdOrFail: jest.fn() };
  const agenciesService = { findByOwnerOrFail: jest.fn() };

  // Groupe et membres explicitement factices.
  const groupe = {
    id: 'group-1',
    title: 'Groupe Factice',
    agencyId: 'agency-1',
    guideId: 'guide-1',
    memberIds: ['p2', 'p1'],
  };
  const membres = [
    {
      id: 'p2',
      fullName: 'Zeinab Factice',
      phone: '+224600000002',
      email: null,
      passportNumber: 'NE-DOIT-PAS-SORTIR',
      bloodType: 'O+',
      emergencyContactFullName: null,
      emergencyContactPhone: null,
      emergencyContactRelationship: null,
      specialNeeds: {
        mobility: 'wheelchair',
        dietary: null,
        medical: '=FORMULE()',
        assistance: null,
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    },
    {
      id: 'p1',
      fullName: 'Alpha Factice',
      phone: null,
      email: 'alpha@exemple.test',
      passportNumber: 'NE-DOIT-PAS-SORTIR',
      bloodType: 'A+',
      emergencyContactFullName: 'Proche Factice',
      emergencyContactPhone: '+224600000003',
      emergencyContactRelationship: 'frère',
      specialNeeds: null,
    },
  ];

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    groupsService.findByIdOrFail.mockResolvedValue(groupe);
    prisma.user.findMany.mockResolvedValue(membres);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1', pilgrimId: 'p1', status: 'confirmed' },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupRosterService,
        { provide: PrismaService, useValue: prisma },
        { provide: GroupsService, useValue: groupsService },
        { provide: AgenciesService, useValue: agenciesService },
      ],
    }).compile();
    service = module.get(GroupRosterService);
  });

  it('donne au guide du groupe la liste triée, sans passeport ni groupe sanguin', async () => {
    const liste = await service.getRoster('guide-1', Role.GUIDE, 'group-1');

    expect(liste.members.map((m) => m.fullName)).toEqual([
      'Alpha Factice',
      'Zeinab Factice',
    ]);
    expect(liste.members[0]).toEqual(
      expect.objectContaining({
        bookingId: 'b1',
        bookingStatus: 'confirmed',
        emergencyContact: {
          fullName: 'Proche Factice',
          phone: '+224600000003',
          relationship: 'frère',
        },
        specialNeeds: undefined,
      }),
    );
    expect(liste.members[1]?.specialNeeds?.mobility).toBe('wheelchair');
    expect(JSON.stringify(liste)).not.toContain('NE-DOIT-PAS-SORTIR');
    expect(JSON.stringify(liste)).not.toContain('bloodType');
  });

  it("refuse le guide d'un autre groupe et l'agence non propriétaire", async () => {
    await expect(
      service.getRoster('autre-guide', Role.GUIDE, 'group-1'),
    ).rejects.toThrow(ForbiddenException);

    agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'autre-agence' });
    await expect(
      service.getRoster('owner-2', Role.AGENCY, 'group-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("autorise l'agence propriétaire et journalise l'accès sans contenu", async () => {
    agenciesService.findByOwnerOrFail.mockResolvedValue({ id: 'agency-1' });
    const journal = jest.spyOn(Logger.prototype, 'log');
    journal.mockClear();

    await service.getRoster('owner-1', Role.AGENCY, 'group-1');

    expect(journal).toHaveBeenCalledTimes(1);
    const message = String(journal.mock.calls[0]?.[0]);
    expect(message).toContain('group-1');
    expect(message).not.toContain('Factice');
  });

  it('exporte un CSV lisible par Excel, formules neutralisées', async () => {
    const csv = await service.getRosterCsv('guide-1', Role.GUIDE, 'group-1');
    const [entete, ligneAlpha, ligneZeinab] = csv.replace('﻿', '').split('\n');

    expect(csv.startsWith('﻿')).toBe(true);
    expect(entete).toContain('information_medicale');
    expect(ligneAlpha).toContain('"confirmée"');
    expect(ligneZeinab).toContain('"fauteuil roulant"');
    expect(ligneZeinab).toContain(`"'=FORMULE()"`);
  });

  it('garde les numéros de téléphone intacts, neutralise les vraies formules', () => {
    expect(celluleCsv('+224620000099')).toBe('"+224620000099"');
    expect(celluleCsv('+224 620 00 00 99')).toBe('"+224 620 00 00 99"');
    expect(celluleCsv('+SOMME(A1)')).toBe(`"'+SOMME(A1)"`);
    expect(celluleCsv('-2+3')).toBe(`"'-2+3"`);
    expect(celluleCsv('@cmd')).toBe(`"'@cmd"`);
  });

  it('échappe les guillemets', () => {
    expect(celluleCsv('Dit "bonjour"')).toBe('"Dit ""bonjour"""');
    expect(celluleCsv(undefined)).toBe('""');
  });
});
