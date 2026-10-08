import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GroupRosterMemberShape,
  GroupRosterShape,
  GroupShape,
} from '../../types/group.types';
import { AgenciesService } from '../agencies/agencies.service';
import { toSpecialNeedsShape } from '../users/users.service';
import { GroupsService } from './groups.service';

const LIBELLE_MOBILITE: Record<string, string> = {
  none: '',
  reduced: 'mobilité réduite',
  wheelchair: 'fauteuil roulant',
};

const LIBELLE_STATUT: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PAYMENT]: 'paiement en attente',
  [BookingStatus.CONFIRMED]: 'confirmée',
  [BookingStatus.CANCELLED]: 'annulée',
  [BookingStatus.COMPLETED]: 'terminée',
};

/**
 * Cellule CSV : guillemets doublés, et neutralisation des formules — un
 * texte saisi par un utilisateur commençant par = + - @ serait sinon
 * exécuté par un tableur à l'ouverture.
 */
export function celluleCsv(valeur: string | undefined): string {
  const texte = valeur ?? '';
  const neutralise = /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte;
  return `"${neutralise.replace(/"/g, '""')}"`;
}

// Idée #41 (backlog "Cent Fonctionnalités") — listes de groupe générées
// au lieu d'être recopiées à la main. Réservées à l'agence propriétaire et
// au guide du groupe : elles contiennent des besoins spéciaux (données de
// santé, idée #69). Chaque consultation est journalisée — qui, quel
// groupe —, jamais son contenu (ADR 0008).
@Injectable()
export class GroupRosterService {
  private readonly accessLogger = new Logger('GroupRosterAccess');

  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async getRoster(
    requesterId: string,
    requesterRole: Role,
    groupId: string,
  ): Promise<GroupRosterShape> {
    const group = await this.groupsService.findByIdOrFail(groupId);
    await this.assertCanReadRoster(requesterId, requesterRole, group);
    this.accessLogger.log(
      `Liste consultée — groupe=${group.id} par=${requesterId} (${requesterRole})`,
    );

    const [membres, reservations] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: group.memberIds } },
        include: { specialNeeds: true },
      }),
      this.prisma.booking.findMany({ where: { groupId: group.id } }),
    ]);
    const reservationParPelerin = new Map(
      reservations.map((r) => [r.pilgrimId, r]),
    );

    const members: GroupRosterMemberShape[] = membres
      .map((membre) => {
        const reservation = reservationParPelerin.get(membre.id);
        return {
          userId: membre.id,
          fullName: membre.fullName,
          phone: membre.phone ?? undefined,
          email: membre.email ?? undefined,
          bookingId: reservation?.id,
          bookingStatus: reservation?.status as BookingStatus | undefined,
          emergencyContact:
            membre.emergencyContactFullName && membre.emergencyContactPhone
              ? {
                  fullName: membre.emergencyContactFullName,
                  phone: membre.emergencyContactPhone,
                  relationship:
                    membre.emergencyContactRelationship ?? undefined,
                }
              : undefined,
          specialNeeds: membre.specialNeeds
            ? toSpecialNeedsShape(membre.specialNeeds)
            : undefined,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));

    return {
      groupId: group.id,
      groupTitle: group.title,
      generatedAt: new Date(),
      members,
    };
  }

  async getRosterCsv(
    requesterId: string,
    requesterRole: Role,
    groupId: string,
  ): Promise<string> {
    const liste = await this.getRoster(requesterId, requesterRole, groupId);
    const entete = [
      'nom',
      'telephone',
      'email',
      'reservation',
      'statut_reservation',
      'contact_urgence',
      'telephone_contact_urgence',
      'lien_contact_urgence',
      'mobilite',
      'regime_alimentaire',
      'information_medicale',
      'accompagnement',
    ].join(',');
    const lignes = liste.members.map((m) =>
      [
        m.fullName,
        m.phone,
        m.email,
        m.bookingId,
        m.bookingStatus ? LIBELLE_STATUT[m.bookingStatus] : undefined,
        m.emergencyContact?.fullName,
        m.emergencyContact?.phone,
        m.emergencyContact?.relationship,
        m.specialNeeds ? LIBELLE_MOBILITE[m.specialNeeds.mobility] : undefined,
        m.specialNeeds?.dietary,
        m.specialNeeds?.medical,
        m.specialNeeds?.assistance,
      ]
        .map(celluleCsv)
        .join(','),
    );
    // BOM UTF-8 : Excel affiche alors correctement les accents.
    return `﻿${[entete, ...lignes].join('\n')}`;
  }

  private async assertCanReadRoster(
    requesterId: string,
    requesterRole: Role,
    group: GroupShape,
  ): Promise<void> {
    if (requesterRole === Role.GUIDE && group.guideId === requesterId) {
      return;
    }
    if (requesterRole === Role.AGENCY) {
      const agency = await this.agenciesService.findByOwnerOrFail(requesterId);
      if (agency.id === group.agencyId) return;
    }
    throw new ForbiddenException(
      "La liste du groupe est réservée à l'agence et au guide du groupe",
    );
  }
}
