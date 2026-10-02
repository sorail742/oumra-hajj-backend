import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MicroCoursesService } from './micro-courses.service';

describe('MicroCoursesService — Micro-cours & Synchronisation hors-ligne (ADR 0007)', () => {
  let service: MicroCoursesService;
  let prisma: {
    microCourse: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    microCourseProgress: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const pilgrimId = 'pilgrim-1';
  const courseId = 'course-1';

  const buildCourse = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: courseId,
    title: 'Introduction aux Rites',
    description: 'Une courte vidéo explicative',
    videoUrl: 'https://cdn.example.com/videos/intro.mp4',
    durationSeconds: 300,
    order: 1,
    category: 'preparation',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildProgress = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'progress-1',
    pilgrimId,
    courseId,
    isCompleted: false,
    clientUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      microCourse: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      microCourseProgress: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MicroCoursesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MicroCoursesService);
  });

  describe('listAll', () => {
    it('renvoie la liste des micro-cours ordonnés', async () => {
      const courses = [
        buildCourse({ id: 'c1', order: 1 }),
        buildCourse({ id: 'c2', order: 2 }),
      ];
      prisma.microCourse.findMany.mockResolvedValue(courses);

      const result = await service.listAll();

      expect(prisma.microCourse.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('c1');
    });

    it('filtre par catégorie si renseignée', async () => {
      prisma.microCourse.findMany.mockResolvedValue([
        buildCourse({ category: 'rites' }),
      ]);

      const result = await service.listAll('rites');

      expect(prisma.microCourse.findMany).toHaveBeenCalledWith({
        where: { category: 'rites' },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('renvoie le cours demandé', async () => {
      prisma.microCourse.findUnique.mockResolvedValue(buildCourse());

      const result = await service.findById(courseId);

      expect(result.id).toBe(courseId);
    });

    it('lève NotFoundException si le cours n existe pas', async () => {
      prisma.microCourse.findUnique.mockResolvedValue(null);

      await expect(service.findById('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('crée un micro-cours avec succès', async () => {
      prisma.microCourse.create.mockResolvedValue(buildCourse());

      const result = await service.create({
        title: 'Introduction aux Rites',
        videoUrl: 'https://cdn.example.com/videos/intro.mp4',
        durationSeconds: 300,
        order: 1,
      });

      expect(prisma.microCourse.create).toHaveBeenCalledWith({
        data: {
          title: 'Introduction aux Rites',
          description: undefined,
          videoUrl: 'https://cdn.example.com/videos/intro.mp4',
          durationSeconds: 300,
          order: 1,
          category: 'preparation',
        },
      });
      expect(result.title).toBe('Introduction aux Rites');
    });
  });

  describe('update', () => {
    it('met à jour un micro-cours', async () => {
      prisma.microCourse.findUnique.mockResolvedValue(buildCourse());
      prisma.microCourse.update.mockResolvedValue(
        buildCourse({ title: 'Titre Modifié' }),
      );

      const result = await service.update(courseId, { title: 'Titre Modifié' });

      expect(prisma.microCourse.update).toHaveBeenCalledWith({
        where: { id: courseId },
        data: expect.objectContaining({ title: 'Titre Modifié' }),
      });
      expect(result.title).toBe('Titre Modifié');
    });

    it('lève NotFoundException si le cours à modifier n existe pas', async () => {
      prisma.microCourse.findUnique.mockResolvedValue(null);

      await expect(
        service.update('unknown', { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('supprime un micro-cours existant', async () => {
      prisma.microCourse.findUnique.mockResolvedValue(buildCourse());
      prisma.microCourse.delete.mockResolvedValue(buildCourse());

      await service.delete(courseId);

      expect(prisma.microCourse.delete).toHaveBeenCalledWith({
        where: { id: courseId },
      });
    });

    it('lève NotFoundException si le cours à supprimer n existe pas', async () => {
      prisma.microCourse.findUnique.mockResolvedValue(null);

      await expect(service.delete('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMyProgress', () => {
    it('renvoie les progressions associées au pèlerin', async () => {
      prisma.microCourseProgress.findMany.mockResolvedValue([
        buildProgress({ isCompleted: true }),
      ]);

      const result = await service.findMyProgress(pilgrimId);

      expect(prisma.microCourseProgress.findMany).toHaveBeenCalledWith({
        where: { pilgrimId },
      });
      expect(result).toHaveLength(1);
      expect(result[0].isCompleted).toBe(true);
    });
  });

  describe('syncBatch — synchronisation hors-ligne (ADR 0007)', () => {
    it('insère la progression si aucune entrée n existe encore sur le serveur (upsert)', async () => {
      prisma.microCourseProgress.findUnique.mockResolvedValue(null);
      prisma.microCourseProgress.upsert.mockResolvedValue(
        buildProgress({ isCompleted: true }),
      );

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            courseId,
            isCompleted: true,
            clientUpdatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(prisma.microCourseProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pilgrimId_courseId: { pilgrimId, courseId } },
          create: expect.objectContaining({
            pilgrimId,
            courseId,
            isCompleted: true,
          }),
        }),
      );
      expect(result[0].isCompleted).toBe(true);
    });

    it('ignore une mise à jour client plus ancienne que la version serveur (résolution de conflit)', async () => {
      const serverRecord = buildProgress({
        isCompleted: true,
        clientUpdatedAt: new Date('2026-06-10T12:00:00Z'),
      });
      prisma.microCourseProgress.findUnique.mockResolvedValue(serverRecord);

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            courseId,
            isCompleted: false,
            clientUpdatedAt: new Date('2026-06-09T10:00:00Z').toISOString(),
          },
        ],
      });

      expect(prisma.microCourseProgress.upsert).not.toHaveBeenCalled();
      expect(result[0].isCompleted).toBe(true);
    });

    it('met à jour si l horodatage client est plus récent que la version serveur', async () => {
      const serverRecord = buildProgress({
        isCompleted: false,
        clientUpdatedAt: new Date('2026-06-08T12:00:00Z'),
      });
      prisma.microCourseProgress.findUnique.mockResolvedValue(serverRecord);
      prisma.microCourseProgress.upsert.mockResolvedValue(
        buildProgress({ isCompleted: true }),
      );

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            courseId,
            isCompleted: true,
            clientUpdatedAt: new Date('2026-06-10T15:00:00Z').toISOString(),
          },
        ],
      });

      expect(prisma.microCourseProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pilgrimId_courseId: { pilgrimId, courseId } },
          update: expect.objectContaining({ isCompleted: true }),
        }),
      );
      expect(result[0].isCompleted).toBe(true);
    });

    it('traite plusieurs items dans le même lot de synchronisation', async () => {
      prisma.microCourseProgress.findUnique.mockResolvedValue(null);
      prisma.microCourseProgress.upsert
        .mockResolvedValueOnce(
          buildProgress({ courseId: 'c1', isCompleted: true }),
        )
        .mockResolvedValueOnce(
          buildProgress({ courseId: 'c2', isCompleted: false }),
        );

      const result = await service.syncBatch(pilgrimId, {
        items: [
          {
            courseId: 'c1',
            isCompleted: true,
            clientUpdatedAt: new Date().toISOString(),
          },
          {
            courseId: 'c2',
            isCompleted: false,
            clientUpdatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(prisma.microCourseProgress.upsert).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });
});
