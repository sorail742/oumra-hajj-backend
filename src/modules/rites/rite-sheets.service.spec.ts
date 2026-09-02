import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { RiteSheetsService } from './rite-sheets.service';
import {
  RiteSheet,
  RiteSheetPilgrimageType,
} from './schemas/rite-sheet.schema';

describe('RiteSheetsService — modération du contenu religieux', () => {
  let service: RiteSheetsService;
  let riteSheetModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    riteSheetModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiteSheetsService,
        { provide: getModelToken(RiteSheet.name), useValue: riteSheetModel },
      ],
    }).compile();

    service = module.get(RiteSheetsService);
  });

  describe('create', () => {
    it('crée toujours une fiche non validée, quoi que le DTO contienne (voir CLAUDE.md)', async () => {
      riteSheetModel.create.mockResolvedValue({});

      await service.create({
        key: 'tawaf',
        title: 'Le Tawaf',
        pilgrimageType: RiteSheetPilgrimageType.BOTH,
        order: 1,
        content: 'Description du Tawaf, tourner sept fois autour de la Kaaba.',
      });

      expect(riteSheetModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ isValidated: false }),
      );
    });
  });

  describe('update', () => {
    it('invalide une fiche déjà validée dès que son contenu est modifié', async () => {
      const sheet = {
        isValidated: true,
        validatedBy: 'reviewer-1',
        validatedAt: new Date(),
        version: 1,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      riteSheetModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(sheet),
      });

      const result = await service.update('sheet-1', {
        content: 'Nouveau texte corrigé.',
      });

      expect(result.isValidated).toBe(false);
      expect(result.validatedBy).toBeUndefined();
      expect(result.validatedAt).toBeUndefined();
      expect(result.version).toBe(2);
    });
  });

  describe('validate', () => {
    it('marque la fiche validée avec le relecteur et la date', async () => {
      const sheet = {
        isValidated: false,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      riteSheetModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(sheet),
      });

      const reviewerId = new Types.ObjectId().toString();
      const result = await service.validate('sheet-1', reviewerId);

      expect(result.isValidated).toBe(true);
      expect(result.validatedBy).toBeDefined();
      expect(result.validatedAt).toBeInstanceOf(Date);
    });
  });

  describe('listPublished', () => {
    it('ne filtre que sur les fiches validées', async () => {
      const execMock = jest.fn().mockResolvedValue([]);
      riteSheetModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: execMock }),
      });

      await service.listPublished();

      expect(riteSheetModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isValidated: true }),
      );
    });
  });
});
