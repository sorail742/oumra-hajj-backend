import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { ORGANIZATIONS_REPOSITORY } from './repositories/organizations-repository.interface';
import { PrismaOrganizationsRepository } from './repositories/prisma-organizations.repository';

/**
 * Module de référence pour le pattern repository — voir
 * docs/backend/adr/0003-*.md. `ORGANIZATIONS_REPOSITORY` est exporté pour
 * que d'autres modules puissent injecter le repository sans connaître
 * Prisma (utile pour tout module qui a besoin de résoudre une organisation
 * sans dupliquer cette logique).
 */
@Module({
  providers: [
    OrganizationsService,
    {
      provide: ORGANIZATIONS_REPOSITORY,
      useClass: PrismaOrganizationsRepository,
    },
  ],
  exports: [OrganizationsService, ORGANIZATIONS_REPOSITORY],
})
export class OrganizationsModule {}
