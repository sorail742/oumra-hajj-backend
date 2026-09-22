import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Package as PrismaPackage,
  PackageStage as PrismaPackageStage,
  PackageStatus as PrismaPackageStatus,
  PilgrimageType as PrismaPilgrimageType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PackageStatus } from '../../common/enums/package-status.enum';
import { PilgrimageType } from '../../common/enums/pilgrimage-type.enum';
import { PackageShape } from '../../types/package.types';
import { AgenciesService } from '../agencies/agencies.service';
import { CreatePackageDto, PackageStageDto } from './dto/create-package.dto';
import { QueryPackagesDto } from './dto/query-packages.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

type PrismaPackageWithStages = PrismaPackage & { stages: PrismaPackageStage[] };

// Inclusion Prisma partagee entre toutes les requetes qui renvoient un
// PackageShape — les etapes doivent toujours etre chargees et triees
// chronologiquement (voir PackageShape.stages).
const WITH_STAGES = { stages: { orderBy: { startDate: 'asc' as const } } };

function toStageCreateInput(stage: PackageStageDto) {
  return {
    city: stage.city,
    hotelName: stage.hotelName,
    distanceToMosqueMeters: stage.distanceToMosqueMeters,
    startDate: new Date(stage.startDate),
    endDate: new Date(stage.endDate),
  };
}

function toPackageShape(pkg: PrismaPackageWithStages): PackageShape {
  return {
    id: pkg.id,
    agencyId: pkg.agencyId,
    type: pkg.type as unknown as PilgrimageType,
    title: pkg.title,
    description: pkg.description ?? undefined,
    startDate: pkg.startDate,
    endDate: pkg.endDate,
    price: pkg.price,
    currency: pkg.currency,
    capacity: pkg.capacity,
    seatsTaken: pkg.seatsTaken,
    stages: pkg.stages.map((stage) => ({
      id: stage.id,
      city: stage.city,
      hotelName: stage.hotelName,
      distanceToMosqueMeters: stage.distanceToMosqueMeters ?? undefined,
      startDate: stage.startDate,
      endDate: stage.endDate,
    })),
    inclusions: pkg.inclusions,
    status: pkg.status as unknown as PackageStatus,
  };
}

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async create(ownerId: string, dto: CreatePackageDto): Promise<PackageShape> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    await this.agenciesService.assertApproved(agency.id);

    const pkg = await this.prisma.package.create({
      data: {
        agencyId: agency.id,
        type: dto.type as unknown as PrismaPilgrimageType,
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        price: dto.price,
        currency: dto.currency,
        capacity: dto.capacity,
        inclusions: dto.inclusions ?? [],
        stages: { create: dto.stages.map(toStageCreateInput) },
      },
      include: WITH_STAGES,
    });
    return toPackageShape(pkg);
  }

  async update(
    ownerId: string,
    packageId: string,
    dto: UpdatePackageDto,
  ): Promise<PackageShape> {
    const pkg = await this.findByIdOrFail(packageId);
    await this.assertOwnership(ownerId, pkg);

    const { stages, startDate, endDate, type, ...rest } = dto;
    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: {
        ...rest,
        ...(type && { type: type as unknown as PrismaPilgrimageType }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        // Remplace l'ensemble des etapes plutot que de les fusionner —
        // memes semantiques que l'ancien champ `hotel`, qui etait deja
        // integralement ecrase a chaque mise a jour.
        ...(stages && {
          stages: {
            deleteMany: {},
            create: stages.map(toStageCreateInput),
          },
        }),
      },
      include: WITH_STAGES,
    });
    return toPackageShape(updated);
  }

  async close(ownerId: string, packageId: string): Promise<PackageShape> {
    const pkg = await this.findByIdOrFail(packageId);
    await this.assertOwnership(ownerId, pkg);

    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: { status: PackageStatus.CLOSED as unknown as PrismaPackageStatus },
      include: WITH_STAGES,
    });
    return toPackageShape(updated);
  }

  async findByIdOrFail(id: string): Promise<PackageShape> {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: WITH_STAGES,
    });
    if (!pkg) {
      throw new NotFoundException('Forfait introuvable');
    }
    return toPackageShape(pkg);
  }

  // Idée #10 (backlog "Cent Fonctionnalités") : recommandation plutôt que
  // liste brute — filtre sur budget, fenêtre de dates et taille du groupe,
  // triée par prix croissant dès qu'un budget est donné (le forfait le
  // moins cher dans le budget est mis en avant en premier).
  async listPublic(query: QueryPackagesDto): Promise<PackageShape[]> {
    const pkgs = await this.prisma.package.findMany({
      where: {
        status: PackageStatus.OPEN as unknown as PrismaPackageStatus,
        ...(query.type && {
          type: query.type as unknown as PrismaPilgrimageType,
        }),
        ...(query.agencyId && { agencyId: query.agencyId }),
        ...(query.maxBudget !== undefined && {
          price: { lte: query.maxBudget },
        }),
        ...((query.startDateFrom || query.startDateTo) && {
          startDate: {
            ...(query.startDateFrom && { gte: new Date(query.startDateFrom) }),
            ...(query.startDateTo && { lte: new Date(query.startDateTo) }),
          },
        }),
      },
      orderBy:
        query.maxBudget !== undefined ? { price: 'asc' } : { startDate: 'asc' },
      include: WITH_STAGES,
    });

    // Places restantes = capacity - seatsTaken : pas une comparaison
    // directe entre deux colonnes exprimable dans un `where` Prisma, donc
    // filtrée après coup plutôt que par une requête SQL brute pour un
    // volume de forfaits qui reste modeste.
    const filtered =
      query.familySize !== undefined
        ? pkgs.filter((p) => p.capacity - p.seatsTaken >= query.familySize!)
        : pkgs;

    return filtered.map(toPackageShape);
  }

  async listMine(ownerId: string): Promise<PackageShape[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    return this.findAllByAgencyId(agency.id);
  }

  // Tous les forfaits d'une agence, quel que soit leur statut — utilisé par
  // CalendarService (idée #70) : une agence a besoin de voir un forfait
  // FULL/CLOSED sur son calendrier des échéances, pas seulement ceux encore
  // ouverts à la réservation (contrairement à `listPublic`).
  async findAllByAgencyId(agencyId: string): Promise<PackageShape[]> {
    const pkgs = await this.prisma.package.findMany({
      where: { agencyId },
      include: WITH_STAGES,
    });
    return pkgs.map(toPackageShape);
  }

  // Appelé par le module bookings à la confirmation d'une réservation.
  async reserveSeat(packageId: string): Promise<PackageShape> {
    const pkg = await this.findByIdOrFail(packageId);
    if (pkg.status !== PackageStatus.OPEN) {
      throw new ConflictException("Ce forfait n'accepte plus de réservation");
    }
    if (pkg.seatsTaken >= pkg.capacity) {
      await this.prisma.package.update({
        where: { id: pkg.id },
        data: { status: PackageStatus.FULL as unknown as PrismaPackageStatus },
      });
      throw new ConflictException('Ce forfait est complet');
    }

    const seatsTaken = pkg.seatsTaken + 1;
    const status = seatsTaken >= pkg.capacity ? PackageStatus.FULL : pkg.status;
    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: { seatsTaken, status: status as unknown as PrismaPackageStatus },
      include: WITH_STAGES,
    });
    return toPackageShape(updated);
  }

  // Appelé si une réservation est annulée après confirmation.
  async releaseSeat(packageId: string): Promise<PackageShape> {
    const pkg = await this.findByIdOrFail(packageId);
    const seatsTaken = Math.max(0, pkg.seatsTaken - 1);
    const status =
      pkg.status === PackageStatus.FULL && seatsTaken < pkg.capacity
        ? PackageStatus.OPEN
        : pkg.status;
    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: { seatsTaken, status: status as unknown as PrismaPackageStatus },
      include: WITH_STAGES,
    });
    return toPackageShape(updated);
  }

  private async assertOwnership(
    ownerId: string,
    pkg: PackageShape,
  ): Promise<void> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (pkg.agencyId !== agency.id) {
      throw new ForbiddenException(
        "Ce forfait n'appartient pas à votre agence",
      );
    }
  }
}
