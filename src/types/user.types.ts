import { Role } from '../common/enums/role.enum';

export interface EmergencyContactShape {
  fullName: string;
  phone: string;
  relationship?: string;
}

export interface UserShape {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  preferredLanguage: string;
  emergencyContact?: EmergencyContactShape;
  bloodType?: string;
  passportNumber?: string;
  agencyId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
