import { Injectable } from '@nestjs/common';
import { Organization, OrganizationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { IOrganizationsRepository } from './organizations-repository.interface';

/**
 * Adapter — seule classe du module `organizations` qui importe
 * `PrismaService`. Voir docs/backend/adr/0003-*.md.
 *
 * `Organization` n'est pas elle-même tenant-scopée (c'est le tenant) : pas
 * de filtre `organizationId` ici, contrairement à tous les autres
 * repositories du projet — voir docs/backend/multi-tenant.md pour la règle
 * qui, elle, s'applique aux tables métier.
 */
@Injectable()
export class PrismaOrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
    });
  }

  async create(data: { name: string }): Promise<Organization> {
    return this.prisma.organization.create({
      data: { name: data.name, status: OrganizationStatus.trialing },
    });
  }

  async updateStatus(
    id: string,
    status: OrganizationStatus,
  ): Promise<Organization> {
    // Écriture simple, volontairement pas gardée par une condition de
    // statut : contrairement à Payment/Subscription
    // (docs/backend/paiements-djomy.md), un changement de statut
    // d'organisation n'est pas déclenché par un webhook concurrent — pas
    // besoin du motif finalizeTransaction ici. Revoir ce choix si un jour
    // deux sources concurrentes peuvent changer ce statut en parallèle.
    return this.prisma.organization.update({
      where: { id },
      data: { status },
    });
  }

  async archive(id: string): Promise<Organization> {
    // Catégorie A (docs/backend/soft-delete.md) : jamais un vrai `delete`.
    // Rappel — la cascade vers les entités enfant (Building, etc.) n'est
    // pas automatique : voir docs/backend/soft-delete.md §Cascade pour la
    // propagation explicite à écrire dans le service, dans la même
    // transaction.
    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
