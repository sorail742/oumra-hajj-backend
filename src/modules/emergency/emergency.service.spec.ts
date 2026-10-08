import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { EmergencyService } from './emergency.service';

describe('EmergencyService — numéros d’urgence (idée #21)', () => {
  let service: EmergencyService;
  let prisma: {
    emergencyNumber: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    booking: { findMany: jest.Mock };
    group: { findMany: jest.Mock };
  };

  // Données explicitement factices.
  const agence = {
    id: 'agency-1',
    legalName: 'Agence Factice',
    contactPhone: '+224600000001',
  };
  const guide = { id: 'guide-1', fullName: 'Guide Factice', phone: null };

  beforeEach(async () => {
    prisma = {
      emergencyNumber: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      group: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EmergencyService);
  });

  it("liste l'annuaire dans l'ordre choisi par l'administration", async () => {
    prisma.emergencyNumber.findMany.mockResolvedValue([
      {
        id: 'n1',
        label: 'Numéro factice',
        category: 'police',
        phone: '000',
        country: 'SA',
        city: null,
        notes: null,
        order: 0,
      },
    ]);

    const numeros = await service.listNumbers();

    expect(prisma.emergencyNumber.findMany).toHaveBeenCalledWith({
      orderBy: [{ order: 'asc' }, { label: 'asc' }],
    });
    expect(numeros[0]).toEqual(
      expect.objectContaining({ id: 'n1', city: undefined, notes: undefined }),
    );
  });

  it('refuse de modifier ou supprimer un numéro inconnu', async () => {
    prisma.emergencyNumber.findUnique.mockResolvedValue(null);
    await expect(service.updateNumber('x', { label: 'Autre' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.deleteNumber('x')).rejects.toThrow(NotFoundException);
    expect(prisma.emergencyNumber.delete).not.toHaveBeenCalled();
  });

  it('déduit agence et guide des réservations non annulées du pèlerin, sans doublon', async () => {
    const groupe = { id: 'group-1', title: 'Groupe Factice', guide };
    prisma.booking.findMany.mockResolvedValue([
      { agency: agence, group: groupe },
      { agency: agence, group: null },
    ]);

    const contacts = await service.findMyContacts('pilgrim-1');

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pilgrimId: 'pilgrim-1', status: { not: 'cancelled' } },
      }),
    );
    expect(contacts.agencies).toEqual([
      {
        agencyId: 'agency-1',
        legalName: 'Agence Factice',
        phone: '+224600000001',
      },
    ]);
    expect(contacts.guides).toEqual([
      {
        groupId: 'group-1',
        groupTitle: 'Groupe Factice',
        fullName: 'Guide Factice',
        phone: undefined,
      },
    ]);
  });

  it("donne au guide l'agence de ses groupes", async () => {
    prisma.group.findMany.mockResolvedValue([{ agency: agence }]);

    const contacts = await service.findMyContacts('guide-1');

    expect(prisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guideId: 'guide-1' } }),
    );
    expect(contacts.agencies).toHaveLength(1);
    expect(contacts.guides).toEqual([]);
  });
});
