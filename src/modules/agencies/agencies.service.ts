import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { RegisterAgencyDto } from './dto/register-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import {
  Agency,
  AgencyDocument,
  AgencyValidationStatus,
} from './schemas/agency.schema';

const SALT_ROUNDS = 12;

@Injectable()
export class AgenciesService {
  constructor(
    @InjectModel(Agency.name)
    private readonly agencyModel: Model<AgencyDocument>,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterAgencyDto): Promise<AgencyDocument> {
    const existing = await this.usersService.findByEmail(dto.contactEmail);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const owner = await this.usersService.create({
      fullName: dto.legalName,
      email: dto.contactEmail,
      passwordHash,
      role: Role.AGENCY,
    });

    return this.agencyModel.create({
      legalName: dto.legalName,
      owner: owner.id,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      address: dto.address,
      validationStatus: AgencyValidationStatus.PENDING,
    });
  }

  async findByOwnerOrFail(ownerId: string): Promise<AgencyDocument> {
    const agency = await this.agencyModel.findOne({ owner: ownerId }).exec();
    if (!agency) {
      throw new NotFoundException('Agence introuvable');
    }
    return agency;
  }

  async findByIdOrFail(id: string): Promise<AgencyDocument> {
    const agency = await this.agencyModel.findById(id).exec();
    if (!agency) {
      throw new NotFoundException('Agence introuvable');
    }
    return agency;
  }

  findByStatus(status?: AgencyValidationStatus): Promise<AgencyDocument[]> {
    const filter = status ? { validationStatus: status } : {};
    return this.agencyModel.find(filter).exec();
  }

  async updateOwn(
    ownerId: string,
    dto: UpdateAgencyDto,
  ): Promise<AgencyDocument> {
    const agency = await this.findByOwnerOrFail(ownerId);
    Object.assign(agency, dto);
    return agency.save();
  }

  async approve(id: string, adminId: string): Promise<AgencyDocument> {
    const agency = await this.findByIdOrFail(id);
    agency.validationStatus = AgencyValidationStatus.APPROVED;
    agency.validatedBy = adminId;
    agency.validatedAt = new Date();
    agency.rejectionReason = undefined;
    return agency.save();
  }

  async reject(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<AgencyDocument> {
    const agency = await this.findByIdOrFail(id);
    agency.validationStatus = AgencyValidationStatus.REJECTED;
    agency.validatedBy = adminId;
    agency.validatedAt = new Date();
    agency.rejectionReason = reason;
    return agency.save();
  }

  // Statistiques globales admin — cahier des charges §3.4.
  async countByStatus(): Promise<Record<AgencyValidationStatus, number>> {
    const counts = await this.agencyModel.aggregate<{
      _id: AgencyValidationStatus;
      count: number;
    }>([{ $group: { _id: '$validationStatus', count: { $sum: 1 } } }]);
    const result = Object.fromEntries(
      Object.values(AgencyValidationStatus).map((status) => [status, 0]),
    ) as Record<AgencyValidationStatus, number>;
    for (const { _id, count } of counts) {
      result[_id] = count;
    }
    return result;
  }

  async assertApproved(agencyId: string): Promise<void> {
    const agency = await this.findByIdOrFail(agencyId);
    if (agency.validationStatus !== AgencyValidationStatus.APPROVED) {
      throw new ConflictException(
        "L'agence n'est pas encore validée par l'administrateur",
      );
    }
  }
}
