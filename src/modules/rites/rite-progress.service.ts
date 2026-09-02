import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SyncRiteProgressDto } from './dto/sync-rite-progress.dto';
import {
  RiteProgress,
  RiteProgressDocument,
} from './schemas/rite-progress.schema';

@Injectable()
export class RiteProgressService {
  constructor(
    @InjectModel(RiteProgress.name)
    private readonly riteProgressModel: Model<RiteProgressDocument>,
  ) {}

  findMine(pilgrimId: string): Promise<RiteProgressDocument[]> {
    return this.riteProgressModel
      .find({ pilgrim: new Types.ObjectId(pilgrimId) })
      .exec();
  }

  // Synchronisation par lot depuis l'app mobile — "local-first, sync-later"
  // avec résolution de conflit par horodatage client (voir ADR 0007).
  async syncBatch(
    pilgrimId: string,
    dto: SyncRiteProgressDto,
  ): Promise<RiteProgressDocument[]> {
    const results: RiteProgressDocument[] = [];

    for (const item of dto.items) {
      const clientUpdatedAt = new Date(item.clientUpdatedAt);
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.riteProgressModel
        .findOne({
          pilgrim: new Types.ObjectId(pilgrimId),
          riteKey: item.riteKey,
        })
        .exec();

      if (
        existing &&
        existing.clientUpdatedAt.getTime() >= clientUpdatedAt.getTime()
      ) {
        results.push(existing);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const updated = await this.riteProgressModel
        .findOneAndUpdate(
          { pilgrim: new Types.ObjectId(pilgrimId), riteKey: item.riteKey },
          {
            $set: {
              ...(item.completed !== undefined
                ? { completed: item.completed }
                : {}),
              ...(item.tawafCount !== undefined
                ? { tawafCount: item.tawafCount }
                : {}),
              ...(item.saiCount !== undefined
                ? { saiCount: item.saiCount }
                : {}),
              clientUpdatedAt,
            },
          },
          { upsert: true, new: true },
        )
        .exec();
      results.push(updated);
    }

    return results;
  }

  async resetCounter(
    pilgrimId: string,
    riteKey: string,
  ): Promise<RiteProgressDocument> {
    return this.riteProgressModel
      .findOneAndUpdate(
        { pilgrim: new Types.ObjectId(pilgrimId), riteKey },
        { $set: { tawafCount: 0, saiCount: 0, clientUpdatedAt: new Date() } },
        { upsert: true, new: true },
      )
      .exec();
  }
}
