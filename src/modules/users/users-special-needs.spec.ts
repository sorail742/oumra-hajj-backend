import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService — besoins spéciaux (idée #69)', () => {
  let service: UsersService;
  let prisma: {
    specialNeeds: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      specialNeeds: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsersService);
  });

  it("renvoie « aucun besoin » tant que le pèlerin n'a rien déclaré", async () => {
    prisma.specialNeeds.findUnique.mockResolvedValue(null);
    await expect(service.getSpecialNeeds('pilgrim-1')).resolves.toEqual({
      mobility: 'none',
    });
  });

  it('remplace la déclaration et efface les champs vidés', async () => {
    const updatedAt = new Date('2026-10-08T12:00:00.000Z');
    prisma.specialNeeds.upsert.mockImplementation(
      ({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve({ id: 'sn-1', ...create, updatedAt }),
    );

    const besoins = await service.replaceSpecialNeeds('pilgrim-1', {
      mobility: 'wheelchair',
      dietary: '  ',
      medical: 'Traitement factice',
    });

    const appel = prisma.specialNeeds.upsert.mock.calls[0]![0] as {
      where: unknown;
      update: Record<string, unknown>;
    };
    expect(appel.where).toEqual({ userId: 'pilgrim-1' });
    expect(appel.update).toEqual({
      mobility: 'wheelchair',
      dietary: null,
      medical: 'Traitement factice',
      assistance: null,
    });
    expect(besoins).toEqual({
      mobility: 'wheelchair',
      dietary: undefined,
      medical: 'Traitement factice',
      assistance: undefined,
      updatedAt,
    });
  });
});
