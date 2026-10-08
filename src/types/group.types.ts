import { BookingStatus } from '../common/enums/booking-status.enum';
import { EmergencyContactShape, SpecialNeedsShape } from './user.types';

export class ItineraryStepShape {
  label!: string;
  date!: Date;
  location?: string;
}

export class MemberLocationShape {
  userId!: string;
  // Nom du membre, pour le reconnaître sur la carte de suivi. Visible des
  // mêmes personnes que la position elle-même (membres, guide, agence,
  // administration — `GroupsService.findAuthorizedOrFail`).
  fullName!: string;
  lat!: number;
  lng!: number;
  updatedAt!: Date;
}

export class GroupShape {
  id!: string;
  packageId!: string;
  agencyId!: string;
  title!: string;
  guideId?: string;
  memberIds!: string[];
  itinerary!: ItineraryStepShape[];
  locations!: MemberLocationShape[];
}

// Idée #41 (backlog "Cent Fonctionnalités") — liste de groupe générée pour
// l'agence propriétaire et le guide du groupe : qui joindre, quel dossier,
// quels besoins anticiper. Jamais le numéro de passeport ni le groupe
// sanguin (minimisation, ADR 0008).
export class GroupRosterMemberShape {
  userId!: string;
  fullName!: string;
  phone?: string;
  email?: string;
  bookingId?: string;
  bookingStatus?: BookingStatus;
  emergencyContact?: EmergencyContactShape;
  // Absent si le pèlerin n'a rien déclaré (idée #69).
  specialNeeds?: SpecialNeedsShape;
}

export class GroupRosterShape {
  groupId!: string;
  groupTitle!: string;
  generatedAt!: Date;
  members!: GroupRosterMemberShape[];
}
