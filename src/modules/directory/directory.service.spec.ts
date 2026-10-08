import { Test, TestingModule } from '@nestjs/testing';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { ReviewsService } from '../reviews/reviews.service';
import { DirectoryService } from './directory.service';

describe('DirectoryService — annuaire public des agences (idée #71)', () => {
  let service: DirectoryService;
  const agenciesService = { findByStatus: jest.fn() };
  const reviewsService = { getTrustScore: jest.fn() };

  // Agences explicitement factices, avec des champs privés qui ne doivent
  // jamais sortir de l'annuaire.
  const agence = (id: string, legalName: string) => ({
    id,
    legalName,
    address: 'Adresse factice',
    validatedAt: new Date('2026-09-01T00:00:00.000Z'),
    contactEmail: 'prive@exemple.test',
    commissionRate: 7,
    bankDetails: { accountName: 'x', accountNumber: 'y', bankName: 'z' },
    legalDocuments: [{ id: 'doc' }],
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    reviewsService.getTrustScore.mockImplementation((agencyId: string) =>
      Promise.resolve({
        agencyId,
        reviewCount: 0,
        concludedBookingsCount: 0,
        badge: 'verified',
      }),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectoryService,
        { provide: AgenciesService, useValue: agenciesService },
        { provide: ReviewsService, useValue: reviewsService },
      ],
    }).compile();
    service = module.get(DirectoryService);
  });

  it('ne liste que les agences approuvées, triées par nom, sans donnée privée', async () => {
    agenciesService.findByStatus.mockResolvedValue([
      agence('a2', 'Zamzam Voyages (factice)'),
      agence('a1', 'Al Amane (factice)'),
    ]);

    const annuaire = await service.listApprovedAgencies();

    expect(agenciesService.findByStatus).toHaveBeenCalledWith(
      AgencyValidationStatus.APPROVED,
    );
    expect(annuaire.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(Object.keys(annuaire[0]!).sort()).toEqual(
      ['address', 'id', 'legalName', 'trustScore', 'validatedAt'].sort(),
    );
    expect(annuaire[0]!.trustScore.badge).toBe('verified');
  });
});
