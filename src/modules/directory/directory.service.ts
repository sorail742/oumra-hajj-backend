import { Injectable } from '@nestjs/common';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { AgencyDirectoryEntryShape } from '../../types/agency.types';
import { AgenciesService } from '../agencies/agencies.service';
import { ReviewsService } from '../reviews/reviews.service';

// Idée #71 (backlog "Cent Fonctionnalités"), volet plateforme : le pèlerin
// vérifie qu'une agence est validée avant de payer. Ce n'est pas le
// registre national de l'État (rôle gouvernemental, ADR 0015 proposé) :
// seulement les agences approuvées par l'administration de la plateforme.
@Injectable()
export class DirectoryService {
  constructor(
    private readonly agenciesService: AgenciesService,
    private readonly reviewsService: ReviewsService,
  ) {}

  async listApprovedAgencies(): Promise<AgencyDirectoryEntryShape[]> {
    const agences = await this.agenciesService.findByStatus(
      AgencyValidationStatus.APPROVED,
    );
    // Un score par agence (trois requêtes chacune) : acceptable tant que
    // l'annuaire compte quelques dizaines d'agences ; à agréger en une
    // requête si le volume grandit.
    const entrees = await Promise.all(
      agences.map(async (agence) => ({
        id: agence.id,
        legalName: agence.legalName,
        address: agence.address,
        validatedAt: agence.validatedAt,
        trustScore: await this.reviewsService.getTrustScore(agence.id),
      })),
    );
    return entrees.sort((a, b) => a.legalName.localeCompare(b.legalName, 'fr'));
  }
}
