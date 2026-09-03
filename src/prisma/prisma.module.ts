import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global : PrismaService devient disponible dans tous les modules migrés
// sans réimport explicite, comme MongooseModule.forFeature le faisait
// implicitement par module — voir ADR 0013.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
