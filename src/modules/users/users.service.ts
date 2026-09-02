import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { CreateUserInternalDto } from './dto/create-user-internal.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  create(dto: CreateUserInternalDto): Promise<UserDocument> {
    return this.userModel.create(dto);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIdOrFail(id: string): Promise<UserDocument> {
    return this.findById(id).then((user) => {
      if (!user) {
        throw new NotFoundException('Utilisateur introuvable');
      }
      return user;
    });
  }

  findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  // Le hash de mot de passe est exclu par défaut (select: false) : on le
  // ré-inclut explicitement pour la vérification lors du login.
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, dto, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  async setActive(userId: string, isActive: boolean): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { isActive }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  findByRole(role: Role, agencyId?: string): Promise<UserDocument[]> {
    const filter: Record<string, unknown> = { role };
    if (agencyId) {
      filter.agency = new Types.ObjectId(agencyId);
    }
    return this.userModel.find(filter).exec();
  }
}
