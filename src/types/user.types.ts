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

// Vue d'administration d'un compte : identité, contact, rôle, statut —
// jamais groupe sanguin, passeport ni contact d'urgence (minimisation des
// données personnelles, voir ADR 0008). Sert aussi à la liste des guides
// d'une agence.
export interface UserSummaryShape {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  agencyId?: string;
  isActive: boolean;
  createdAt: Date;
}
