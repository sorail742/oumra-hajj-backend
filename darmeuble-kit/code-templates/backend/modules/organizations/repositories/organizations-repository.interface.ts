import { Organization, OrganizationStatus } from '@prisma/client';

/**
 * Port — voir docs/backend/adr/0003-pattern-repository-port-adapter.md.
 * `organizations` sert de module de référence pour ce pattern, comme
 * `clients` chez smartsms-backend.
 *
 * Un service métier injecte `IOrganizationsRepository` via le jeton
 * `ORGANIZATIONS_REPOSITORY`, jamais `PrismaService` directement.
 */
export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

export interface IOrganizationsRepository {
  findById(id: string): Promise<Organization | null>;
  create(data: { name: string }): Promise<Organization>;
  updateStatus(id: string, status: OrganizationStatus): Promise<Organization>;
  /**
   * Archive (soft delete) — voir docs/backend/soft-delete.md. Ne supprime
   * jamais physiquement une organisation : `Organization` est une entité
   * racine de catégorie A.
   */
  archive(id: string): Promise<Organization>;
}
