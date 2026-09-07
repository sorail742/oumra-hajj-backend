import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Package as PrismaPackage,
  PackageStatus as PrismaPackageStatus,
  PilgrimageType as PrismaPilgrimageType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PackageStatus } from '../../common/enums/package-status.enum';
import { PilgrimageType } from '../../common/enums/pilgrimage-type.enum';
import { PackageShape } from '../../types/package.types';
import { AgenciesService } from '../agencies/agencies.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { QueryPackagesDto } from './dto/query-packages.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

function toPackageShape(pkg: PrismaPackage): PackageShape {
  const hasHotel =
    pkg.hotelName !== null ||
    pkg.hotelCity !== null ||
    pkg.hotelDistanceToMosqueM !== null;

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
    hotel: hasHotel
      ? {
          name: pkg.hotelName ?? '',
          city: pkg.hotelCity ?? '',
          distanceToMosqueMeters: pkg.hotelDistanceToMosqueM ?? undefined,
        }
      : undefined,
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
        hotelName: dto.hotel?.name,
        hotelCity: dto.hotel?.city,
        hotelDistanceToMosqueM: dto.hotel?.distanceToMosqueMeters,
        inclusions: dto.inclusions ?? [],
      },
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

    const { hotel, startDate, endDate, type, ...rest } = dto;
    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: {
        ...rest,
        ...(type && { type: type as unknown as PrismaPilgrimageType }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(hotel && {
          hotelName: hotel.name,
          hotelCity: hotel.city,
          hotelDistanceToMosqueM: hotel.distanceToMosqueMeters,
        }),
      },
    });
    return toPackageShape(updated);
  }

  async close(ownerId: string, packageId: string): Promise<PackageShape> {
    const pkg = await this.findByIdOrFail(packageId);
    await this.assertOwnership(ownerId, pkg);

    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: { status: PackageStatus.CLOSED as unknown as PrismaPackageStatus },
    });
    return toPackageShape(updated);
  }

  async findByIdOrFail(id: string): Promise<PackageShape> {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) {
      throw new NotFoundException('Forfait introuvable');
    }
    return toPackageShape(pkg);
  }

  async listPublic(query: QueryPackagesDto): Promise<PackageShape[]> {
    const pkgs = await this.prisma.package.findMany({
      where: {
        status: PackageStatus.OPEN as unknown as PrismaPackageStatus,
        ...(query.type && {
          type: query.type as unknown as PrismaPilgrimageType,
        }),
        ...(query.agencyId && { agencyId: query.agencyId }),
      },
      orderBy: { startDate: 'asc' },
    });
    return pkgs.map(toPackageShape);
  }

  async listMine(ownerId: string): Promise<PackageShape[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const pkgs = await this.prisma.package.findMany({
      where: { agencyId: agency.id },
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
