import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DisputeStatus as PrismaDisputeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DisputeStatus } from '../../types/dispute.types';

// Conservation d'un litige clos, puis suppression (minimisation — issue
// #63). Durée retenue par défaut, à confirmer au regard du droit
// applicable avant la mise en production. Les messages partent avec le
// litige (cascade).
export const DISPUTE_RETENTION_MONTHS = 24;

const CLOS = [DisputeStatus.RESOLVED, DisputeStatus.CLOSED].map(
  (s) => s as unknown as PrismaDisputeStatus,
);

@Injectable()
export class DisputePurgeService {
  private readonly logger = new Logger(DisputePurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 3 * * *')
  async purgeClosedDisputes(now = new Date()): Promise<number> {
    const limite = new Date(now);
    limite.setUTCMonth(limite.getUTCMonth() - DISPUTE_RETENTION_MONTHS);
    const { count } = await this.prisma.dispute.deleteMany({
      where: { status: { in: CLOS }, closedAt: { lt: limite } },
    });
    if (count > 0) {
      this.logger.log(`Purge : ${count} litige(s) clos supprimé(s).`);
    }
    return count;
  }
}
