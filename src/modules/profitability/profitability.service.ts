import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProfitabilityScenarioKind,
  ProfitabilityScenarioShape,
  ProfitabilitySimulationShape,
} from '../../types/profitability.types';
import { AgenciesService } from '../agencies/agencies.service';
import { ProfitabilitySimulationDto } from './dto/profitability-simulation.dto';

const arrondi = (n: number) => Math.round(n * 100) / 100;

const somme = (lignes: { amount: number }[]) =>
  lignes.reduce((s, l) => s + l.amount, 0);

interface Hypotheses {
  price: number;
  commissionRate: number;
  costPerPilgrim: number;
  fixedCosts: number;
}

function scenario(
  kind: ProfitabilityScenarioKind,
  pilgrims: number,
  h: Hypotheses,
): ProfitabilityScenarioShape {
  const revenue = h.price * pilgrims;
  const platformCommission = revenue * h.commissionRate;
  const variableCosts = h.costPerPilgrim * pilgrims;
  const margin = revenue - platformCommission - variableCosts - h.fixedCosts;
  return {
    kind,
    pilgrims,
    revenue: arrondi(revenue),
    platformCommission: arrondi(platformCommission),
    variableCosts: arrondi(variableCosts),
    fixedCosts: arrondi(h.fixedCosts),
    margin: arrondi(margin),
    marginRate:
      revenue > 0 ? Math.round((margin / revenue) * 1000) / 1000 : undefined,
    marginPerPilgrim: pilgrims > 0 ? arrondi(margin / pilgrims) : undefined,
  };
}

// Idée #48 (backlog "Cent Fonctionnalités") — simulateur de rentabilité :
// coût réel, prix de vente et commission de la plateforme, avant de
// publier une offre ou pour un forfait existant. Tout est calculé ici, à
// partir du taux de commission lu en base (jamais fourni par le client) ;
// rien n'est enregistré, ce n'est pas une opération financière.
@Injectable()
export class ProfitabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async simulate(
    ownerId: string,
    dto: ProfitabilitySimulationDto,
  ): Promise<ProfitabilitySimulationShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const forfait = dto.packageId
      ? await this.prisma.package.findUnique({
          where: { id: dto.packageId },
          select: {
            agencyId: true,
            title: true,
            price: true,
            currency: true,
            capacity: true,
            seatsTaken: true,
          },
        })
      : null;
    if (dto.packageId) {
      if (!forfait) throw new NotFoundException('Forfait introuvable');
      if (forfait.agencyId !== agence.id) {
        throw new ForbiddenException(
          "Ce forfait n'appartient pas à votre agence",
        );
      }
    }
    const price = dto.price ?? forfait?.price;
    const capacity = dto.capacity ?? forfait?.capacity;
    if (price === undefined || capacity === undefined) {
      throw new BadRequestException(
        'Prix et capacité sont requis sans forfait existant',
      );
    }
    const expected = dto.expectedPilgrims ?? capacity;
    if (expected > capacity) {
      throw new BadRequestException(
        'Le remplissage attendu dépasse la capacité',
      );
    }
    const h: Hypotheses = {
      price,
      commissionRate: agence.commissionRate,
      costPerPilgrim: somme(dto.costsPerPilgrim),
      fixedCosts: somme(dto.fixedCosts),
    };

    const unitContribution =
      h.price * (1 - h.commissionRate) - h.costPerPilgrim;
    const breakEvenPilgrims =
      unitContribution > 0
        ? Math.ceil(h.fixedCosts / unitContribution)
        : undefined;
    const netParPrix = expected * (1 - h.commissionRate);
    const minimumPrice =
      netParPrix > 0
        ? arrondi((h.costPerPilgrim * expected + h.fixedCosts) / netParPrix)
        : undefined;

    const scenarios = [
      scenario('expected', expected, h),
      ...(forfait ? [scenario('sold', forfait.seatsTaken, h)] : []),
      scenario('half', Math.round(capacity * 0.5), h),
      scenario('three_quarters', Math.round(capacity * 0.75), h),
      scenario('full', capacity, h),
    ];

    return {
      packageId: dto.packageId,
      packageTitle: forfait?.title,
      currency: forfait?.currency ?? dto.currency ?? 'GNF',
      price: arrondi(price),
      capacity,
      commissionRate: h.commissionRate,
      costPerPilgrim: arrondi(h.costPerPilgrim),
      fixedCostsTotal: arrondi(h.fixedCosts),
      unitContribution: arrondi(unitContribution),
      breakEvenPilgrims,
      breakEvenReachable:
        breakEvenPilgrims !== undefined && breakEvenPilgrims <= capacity,
      minimumPrice,
      scenarios,
    };
  }
}
