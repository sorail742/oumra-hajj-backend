import { Injectable } from '@nestjs/common';
import { RiteProgress as PrismaRiteProgress } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RiteProgressShape } from '../../types/rite.types';
import { SyncRiteProgressDto } from './dto/sync-rite-progress.dto';

function toRiteProgressShape(progress: PrismaRiteProgress): RiteProgressShape {
  return {
    id: progress.id,
    pilgrimId: progress.pilgrimId,
    riteKey: progress.riteKey,
    completed: progress.completed,
    tawafCount: progress.tawafCount,
    saiCount: progress.saiCount,
    clientUpdatedAt: progress.clientUpdatedAt,
  };
}

@Injectable()
export class RiteProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(pilgrimId: string): Promise<RiteProgressShape[]> {
    const items = await this.prisma.riteProgress.findMany({
      where: { pilgrimId },
    });
    return items.map(toRiteProgressShape);
  }

  // Synchronisation par lot depuis l'app mobile — "local-first, sync-later"
  // avec résolution de conflit par horodatage client (voir ADR 0007). Pas
  // d'équivalent Prisma en une seule requête pour "n'écraser que si plus
  // récent" : lecture puis upsert conditionnel, comme avant la migration.
  async syncBatch(
    pilgrimId: string,
    dto: SyncRiteProgressDto,
  ): Promise<RiteProgressShape[]> {
    const results: RiteProgressShape[] = [];

    for (const item of dto.items) {
      const clientUpdatedAt = new Date(item.clientUpdatedAt);
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.prisma.riteProgress.findUnique({
        where: { pilgrimId_riteKey: { pilgrimId, riteKey: item.riteKey } },
      });

      if (
        existing &&
        existing.clientUpdatedAt.getTime() >= clientUpdatedAt.getTime()
      ) {
        results.push(toRiteProgressShape(existing));
        continue;
      }

      const data = {
        ...(item.completed !== undefined && { completed: item.completed }),
        ...(item.tawafCount !== undefined && { tawafCount: item.tawafCount }),
        ...(item.saiCount !== undefined && { saiCount: item.saiCount }),
        clientUpdatedAt,
      };

      // eslint-disable-next-line no-await-in-loop
      const updated = await this.prisma.riteProgress.upsert({
        where: { pilgrimId_riteKey: { pilgrimId, riteKey: item.riteKey } },
        create: { pilgrimId, riteKey: item.riteKey, ...data },
        update: data,
      });
      results.push(toRiteProgressShape(updated));
    }

    return results;
  }

  async resetCounter(
    pilgrimId: string,
    riteKey: string,
  ): Promise<RiteProgressShape> {
    const now = new Date();
    const updated = await this.prisma.riteProgress.upsert({
      where: { pilgrimId_riteKey: { pilgrimId, riteKey } },
      create: {
        pilgrimId,
        riteKey,
        tawafCount: 0,
        saiCount: 0,
        clientUpdatedAt: now,
      },
      update: { tawafCount: 0, saiCount: 0, clientUpdatedAt: now },
    });
    return toRiteProgressShape(updated);
  }
}
