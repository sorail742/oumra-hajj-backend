import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import {
  IOrganizationsRepository,
  ORGANIZATIONS_REPOSITORY,
} from './repositories/organizations-repository.interface';

/**
 * Exemple minimal — service métier qui injecte le **port**, jamais
 * `PrismaService`. Voir docs/backend/adr/0003-*.md.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly organizationsRepository: IOrganizationsRepository,
  ) {}

  async findByIdOrFail(id: string): Promise<Organization> {
    const organization = await this.organizationsRepository.findById(id);
    if (!organization) {
      throw new NotFoundException('Organisation introuvable');
    }
    return organization;
  }

  async register(name: string): Promise<Organization> {
    return this.organizationsRepository.create({ name });
  }
}
