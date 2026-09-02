import { Types } from 'mongoose';
import { Role } from '../../../common/enums/role.enum';

// DTO interne (non exposé publiquement) utilisé par AuthService pour créer
// un utilisateur lors d'une inscription OTP ou d'une création agence/admin.
export interface CreateUserInternalDto {
  fullName: string;
  phone?: string;
  email?: string;
  passwordHash?: string;
  role: Role;
  agency?: Types.ObjectId;
}
