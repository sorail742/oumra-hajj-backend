import { Role } from '../common/enums/role.enum';

export class EmergencyContactShape {
  fullName!: string;
  phone!: string;
  relationship?: string;
}

export class UserShape {
  id!: string;
  fullName!: string;
  phone?: string;
  email?: string;
  role!: Role;
  preferredLanguage!: string;
  emergencyContact?: EmergencyContactShape;
  bloodType?: string;
  passportNumber?: string;
  agencyId?: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

// Vue d'administration d'un compte : identité, contact, rôle, statut —
// jamais groupe sanguin, passeport ni contact d'urgence (minimisation des
// données personnelles, voir ADR 0008). Sert aussi à la liste des guides
// d'une agence.
export class UserSummaryShape {
  id!: string;
  fullName!: string;
  phone?: string;
  email?: string;
  role!: Role;
  agencyId?: string;
  isActive!: boolean;
  createdAt!: Date;
}

// Idée #69 (backlog "Cent Fonctionnalités") — besoins spéciaux déclarés par
// le pèlerin. Données de santé : jamais journalisées ; visibles du pèlerin,
// de l'agence de ses réservations et du guide de ses groupes (liste de
// groupe, idée #41), jamais de l'administration.
export const MOBILITY_LEVELS = ['none', 'reduced', 'wheelchair'] as const;
export type MobilityLevel = (typeof MOBILITY_LEVELS)[number];

export class SpecialNeedsShape {
  mobility!: MobilityLevel;
  dietary?: string;
  medical?: string;
  assistance?: string;
  // Absent tant que le pèlerin n'a rien déclaré.
  updatedAt?: Date;
}
