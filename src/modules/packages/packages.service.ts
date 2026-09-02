import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgenciesService } from '../agencies/agencies.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { QueryPackagesDto } from './dto/query-packages.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import {
  Package,
  PackageDocument,
  PackageStatus,
} from './schemas/package.schema';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(Package.name)
    private readonly packageModel: Model<PackageDocument>,
    private readonly agenciesService: AgenciesService,
  ) {}

  async create(
    ownerId: string,
    dto: CreatePackageDto,
  ): Promise<PackageDocument> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    await this.agenciesService.assertApproved(
      (agency._id as Types.ObjectId).toString(),
    );

    return this.packageModel.create({ ...dto, agency: agency._id });
  }

  async update(
    ownerId: string,
    packageId: string,
    dto: UpdatePackageDto,
  ): Promise<PackageDocument> {
    const pkg = await this.findByIdOrFail(packageId);
    await this.assertOwnership(ownerId, pkg);
    Object.assign(pkg, dto);
    return pkg.save();
  }

  async close(ownerId: string, packageId: string): Promise<PackageDocument> {
    const pkg = await this.findByIdOrFail(packageId);
    await this.assertOwnership(ownerId, pkg);
    pkg.status = PackageStatus.CLOSED;
    return pkg.save();
  }

  findByIdOrFail(id: string): Promise<PackageDocument> {
    return this.packageModel
      .findById(id)
      .exec()
      .then((pkg) => {
        if (!pkg) {
          throw new NotFoundException('Forfait introuvable');
        }
        return pkg;
      });
  }

  listPublic(query: QueryPackagesDto): Promise<PackageDocument[]> {
    const filter: Record<string, unknown> = { status: PackageStatus.OPEN };
    if (query.type) {
      filter.type = query.type;
    }
    if (query.agencyId) {
      filter.agency = new Types.ObjectId(query.agencyId);
    }
    return this.packageModel.find(filter).sort({ startDate: 1 }).exec();
  }

  async listMine(ownerId: string): Promise<PackageDocument[]> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    return this.packageModel.find({ agency: agency._id }).exec();
  }

  // Appelé par le module bookings à la confirmation d'une réservation.
  async reserveSeat(packageId: string): Promise<PackageDocument> {
    const pkg = await this.findByIdOrFail(packageId);
    if (pkg.status !== PackageStatus.OPEN) {
      throw new ConflictException("Ce forfait n'accepte plus de réservation");
    }
    if (pkg.seatsTaken >= pkg.capacity) {
      pkg.status = PackageStatus.FULL;
      await pkg.save();
      throw new ConflictException('Ce forfait est complet');
    }

    pkg.seatsTaken += 1;
    if (pkg.seatsTaken >= pkg.capacity) {
      pkg.status = PackageStatus.FULL;
    }
    return pkg.save();
  }

  // Appelé si une réservation est annulée après confirmation.
  async releaseSeat(packageId: string): Promise<PackageDocument> {
    const pkg = await this.findByIdOrFail(packageId);
    pkg.seatsTaken = Math.max(0, pkg.seatsTaken - 1);
    if (pkg.status === PackageStatus.FULL && pkg.seatsTaken < pkg.capacity) {
      pkg.status = PackageStatus.OPEN;
    }
    return pkg.save();
  }

  private async assertOwnership(
    ownerId: string,
    pkg: PackageDocument,
  ): Promise<void> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    if (!pkg.agency.equals(agency._id as Types.ObjectId)) {
      throw new ForbiddenException(
        "Ce forfait n'appartient pas à votre agence",
      );
    }
  }
}
