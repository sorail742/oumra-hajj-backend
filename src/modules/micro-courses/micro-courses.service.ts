import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MicroCourse as PrismaMicroCourse,
  MicroCourseProgress as PrismaMicroCourseProgress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MicroCourseProgressShape,
  MicroCourseShape,
} from '../../types/micro-course.types';
import { CreateMicroCourseDto } from './dto/create-micro-course.dto';
import { SyncMicroCourseProgressDto } from './dto/sync-micro-course-progress.dto';
import { UpdateMicroCourseDto } from './dto/update-micro-course.dto';

function toMicroCourseShape(course: PrismaMicroCourse): MicroCourseShape {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    videoUrl: course.videoUrl,
    durationSeconds: course.durationSeconds,
    order: course.order,
    category: course.category,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toMicroCourseProgressShape(
  progress: PrismaMicroCourseProgress,
): MicroCourseProgressShape {
  return {
    id: progress.id,
    pilgrimId: progress.pilgrimId,
    courseId: progress.courseId,
    isCompleted: progress.isCompleted,
    clientUpdatedAt: progress.clientUpdatedAt,
  };
}

@Injectable()
export class MicroCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(category?: string): Promise<MicroCourseShape[]> {
    const courses = await this.prisma.microCourse.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return courses.map(toMicroCourseShape);
  }

  async findById(id: string): Promise<MicroCourseShape> {
    const course = await this.prisma.microCourse.findUnique({
      where: { id },
    });
    if (!course) {
      throw new NotFoundException('Micro-cours introuvable');
    }
    return toMicroCourseShape(course);
  }

  async create(dto: CreateMicroCourseDto): Promise<MicroCourseShape> {
    const course = await this.prisma.microCourse.create({
      data: {
        title: dto.title,
        description: dto.description,
        videoUrl: dto.videoUrl,
        durationSeconds: dto.durationSeconds ?? 0,
        order: dto.order ?? 0,
        category: dto.category ?? 'preparation',
      },
    });
    return toMicroCourseShape(course);
  }

  async update(
    id: string,
    dto: UpdateMicroCourseDto,
  ): Promise<MicroCourseShape> {
    await this.findById(id);

    const updated = await this.prisma.microCourse.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
        ...(dto.durationSeconds !== undefined && {
          durationSeconds: dto.durationSeconds,
        }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.category !== undefined && { category: dto.category }),
      },
    });
    return toMicroCourseShape(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.microCourse.delete({
      where: { id },
    });
  }

  async findMyProgress(pilgrimId: string): Promise<MicroCourseProgressShape[]> {
    const items = await this.prisma.microCourseProgress.findMany({
      where: { pilgrimId },
    });
    return items.map(toMicroCourseProgressShape);
  }

  // Synchronisation par lot depuis l'application mobile — "local-first, sync-later"
  // avec résolution de conflit par horodatage client (voir ADR 0007).
  // Ne met à jour que si l'horodatage client est plus récent que la version serveur.
  async syncBatch(
    pilgrimId: string,
    dto: SyncMicroCourseProgressDto,
  ): Promise<MicroCourseProgressShape[]> {
    const results: MicroCourseProgressShape[] = [];

    for (const item of dto.items) {
      const clientUpdatedAt = new Date(item.clientUpdatedAt);
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.prisma.microCourseProgress.findUnique({
        where: { pilgrimId_courseId: { pilgrimId, courseId: item.courseId } },
      });

      if (
        existing &&
        existing.clientUpdatedAt.getTime() >= clientUpdatedAt.getTime()
      ) {
        results.push(toMicroCourseProgressShape(existing));
        continue;
      }

      const data = {
        ...(item.isCompleted !== undefined && {
          isCompleted: item.isCompleted,
        }),
        clientUpdatedAt,
      };

      // eslint-disable-next-line no-await-in-loop
      const updated = await this.prisma.microCourseProgress.upsert({
        where: { pilgrimId_courseId: { pilgrimId, courseId: item.courseId } },
        create: {
          pilgrimId,
          courseId: item.courseId,
          isCompleted: item.isCompleted ?? false,
          clientUpdatedAt,
        },
        update: data,
      });
      results.push(toMicroCourseProgressShape(updated));
    }

    return results;
  }
}
