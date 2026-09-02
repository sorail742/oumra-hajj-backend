import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { RiteProgressService } from './rite-progress.service';
import { RiteProgress } from './schemas/rite-progress.schema';

describe('RiteProgressService — synchronisation hors-ligne (ADR 0007)', () => {
  let service: RiteProgressService;
  let riteProgressModel: { findOne: jest.Mock; findOneAndUpdate: jest.Mock };

  const pilgrimId = new Types.ObjectId().toString();

  beforeEach(async () => {
    riteProgressModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiteProgressService,
        {
          provide: getModelToken(RiteProgress.name),
          useValue: riteProgressModel,
        },
      ],
    }).compile();

    service = module.get(RiteProgressService);
  });

  describe('syncBatch', () => {
    it("applique la mise à jour quand aucune progression locale n'existe encore (upsert)", async () => {
      riteProgressModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const updated = { riteKey: 'tawaf', tawafCount: 3 };
      riteProgressModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 3,
            clientUpdatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(riteProgressModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toEqual([updated]);
    });

    it('ignore une mise à jour plus ancienne que ce qui est déjà stocké (conflit résolu par horodatage client)', async () => {
      const serverSideRecord = {
        riteKey: 'tawaf',
        tawafCount: 7,
        clientUpdatedAt: new Date('2026-01-02T10:00:00Z'),
      };
      riteProgressModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(serverSideRecord),
      });

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 2,
            clientUpdatedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
          },
        ],
      });

      expect(riteProgressModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual([serverSideRecord]);
    });

    it('applique une mise à jour plus récente que ce qui est stocké', async () => {
      const serverSideRecord = {
        riteKey: 'tawaf',
        tawafCount: 2,
        clientUpdatedAt: new Date('2026-01-01T10:00:00Z'),
      };
      riteProgressModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(serverSideRecord),
      });
      const updated = { riteKey: 'tawaf', tawafCount: 7 };
      riteProgressModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 7,
            clientUpdatedAt: new Date('2026-01-02T10:00:00Z').toISOString(),
          },
        ],
      });

      expect(riteProgressModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toEqual([updated]);
    });

    it('traite plusieurs étapes du lot indépendamment', async () => {
      riteProgressModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      riteProgressModel.findOneAndUpdate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ riteKey: 'tawaf' }),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ riteKey: 'sai' }),
        });

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 3,
            clientUpdatedAt: new Date().toISOString(),
          },
          {
            riteKey: 'sai',
            saiCount: 4,
            clientUpdatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(riteProgressModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetCounter', () => {
    it("remet le compteur Tawaf/Sa'i courant à zéro", async () => {
      riteProgressModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ tawafCount: 0, saiCount: 0 }),
      });

      const result = await service.resetCounter(pilgrimId, 'tawaf');

      expect(riteProgressModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ riteKey: 'tawaf' }),
        expect.objectContaining({
          $set: expect.objectContaining({ tawafCount: 0, saiCount: 0 }),
        }),
        expect.objectContaining({ upsert: true }),
      );
      expect(result.tawafCount).toBe(0);
    });
  });
});
