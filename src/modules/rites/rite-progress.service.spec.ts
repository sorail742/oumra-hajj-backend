import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RiteProgressService } from './rite-progress.service';

describe('RiteProgressService — synchronisation hors-ligne (ADR 0007)', () => {
  let service: RiteProgressService;
  let prisma: {
    riteProgress: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  const pilgrimId = 'pilgrim-1';

  const buildProgress = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'progress-1',
    pilgrimId,
    riteKey: 'tawaf',
    completed: false,
    tawafCount: 0,
    saiCount: 0,
    clientUpdatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      riteProgress: { findUnique: jest.fn(), upsert: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiteProgressService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RiteProgressService);
  });

  describe('syncBatch', () => {
    it("applique la mise à jour quand aucune progression locale n'existe encore (upsert)", async () => {
      prisma.riteProgress.findUnique.mockResolvedValue(null);
      prisma.riteProgress.upsert.mockResolvedValue(
        buildProgress({ tawafCount: 3 }),
      );

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 3,
            clientUpdatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(prisma.riteProgress.upsert).toHaveBeenCalled();
      expect(result[0].tawafCount).toBe(3);
    });

    it('ignore une mise à jour plus ancienne que ce qui est déjà stocké (conflit résolu par horodatage client)', async () => {
      const serverSideRecord = buildProgress({
        tawafCount: 7,
        clientUpdatedAt: new Date('2026-01-02T10:00:00Z'),
      });
      prisma.riteProgress.findUnique.mockResolvedValue(serverSideRecord);

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 2,
            clientUpdatedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
          },
        ],
      });

      expect(prisma.riteProgress.upsert).not.toHaveBeenCalled();
      expect(result[0].tawafCount).toBe(7);
    });

    it('applique une mise à jour plus récente que ce qui est stocké', async () => {
      const serverSideRecord = buildProgress({
        tawafCount: 2,
        clientUpdatedAt: new Date('2026-01-01T10:00:00Z'),
      });
      prisma.riteProgress.findUnique.mockResolvedValue(serverSideRecord);
      prisma.riteProgress.upsert.mockResolvedValue(
        buildProgress({ tawafCount: 7 }),
      );

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            riteKey: 'tawaf',
            tawafCount: 7,
            clientUpdatedAt: new Date('2026-01-02T10:00:00Z').toISOString(),
          },
        ],
      });

      expect(prisma.riteProgress.upsert).toHaveBeenCalled();
      expect(result[0].tawafCount).toBe(7);
    });

    it('traite plusieurs étapes du lot indépendamment', async () => {
      prisma.riteProgress.findUnique.mockResolvedValue(null);
      prisma.riteProgress.upsert
        .mockResolvedValueOnce(buildProgress({ riteKey: 'tawaf' }))
        .mockResolvedValueOnce(buildProgress({ riteKey: 'sai' }));

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
      expect(prisma.riteProgress.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetCounter', () => {
    it("remet le compteur Tawaf/Sa'i courant à zéro", async () => {
      prisma.riteProgress.upsert.mockResolvedValue(
        buildProgress({ tawafCount: 0, saiCount: 0 }),
      );

      const result = await service.resetCounter(pilgrimId, 'tawaf');

      expect(prisma.riteProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pilgrimId_riteKey: { pilgrimId, riteKey: 'tawaf' } },
          update: expect.objectContaining({ tawafCount: 0, saiCount: 0 }),
        }),
      );
      expect(result.tawafCount).toBe(0);
    });
  });
});
