import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RiteSheetPilgrimageType } from '../../common/enums/rite-sheet-pilgrimage-type.enum';
import { RiteSheetsService } from './rite-sheets.service';

describe('RiteSheetsService — modération du contenu religieux', () => {
  let service: RiteSheetsService;
  let prisma: {
    riteSheet: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const buildSheet = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'sheet-1',
    key: 'tawaf',
    title: 'Le Tawaf',
    pilgrimageType: 'both',
    order: 1,
    content: 'Description du Tawaf, tourner sept fois autour de la Kaaba.',
    audioRef: null,
    language: 'fr',
    version: 1,
    isValidated: false,
    validatedById: null,
    validatedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      riteSheet: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiteSheetsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RiteSheetsService);
  });

  describe('create', () => {
    it('crée toujours une fiche non validée, quoi que le DTO contienne (voir CLAUDE.md)', async () => {
      prisma.riteSheet.create.mockResolvedValue(buildSheet());

      await service.create({
        key: 'tawaf',
        title: 'Le Tawaf',
        pilgrimageType: RiteSheetPilgrimageType.BOTH,
        order: 1,
        content: 'Description du Tawaf, tourner sept fois autour de la Kaaba.',
      });

      expect(prisma.riteSheet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isValidated: false }),
        }),
      );
    });
  });

  describe('update', () => {
    it('invalide une fiche déjà validée dès que son contenu est modifié', async () => {
      prisma.riteSheet.update.mockResolvedValue(
        buildSheet({
          isValidated: false,
          validatedById: null,
          validatedAt: null,
          version: 2,
          content: 'Nouveau texte corrigé.',
        }),
      );

      const result = await service.update('sheet-1', {
        content: 'Nouveau texte corrigé.',
      });

      expect(prisma.riteSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isValidated: false,
            validatedById: null,
            validatedAt: null,
            version: { increment: 1 },
          }),
        }),
      );
      expect(result.isValidated).toBe(false);
      expect(result.validatedById).toBeUndefined();
      expect(result.validatedAt).toBeUndefined();
      expect(result.version).toBe(2);
    });
  });

  describe('validate', () => {
    it('marque la fiche validée avec le relecteur et la date', async () => {
      const reviewerId = 'reviewer-1';
      prisma.riteSheet.update.mockResolvedValue(
        buildSheet({
          isValidated: true,
          validatedById: reviewerId,
          validatedAt: new Date(),
        }),
      );

      const result = await service.validate('sheet-1', reviewerId);

      expect(result.isValidated).toBe(true);
      expect(result.validatedById).toBe(reviewerId);
      expect(result.validatedAt).toBeInstanceOf(Date);
    });
  });

  describe('listPublished', () => {
    it('ne filtre que sur les fiches validées', async () => {
      prisma.riteSheet.findMany.mockResolvedValue([]);

      await service.listPublished();

      expect(prisma.riteSheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isValidated: true }),
        }),
      );
    });
  });
});
