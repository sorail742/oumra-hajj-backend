import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BillingPartyShape,
  ContractShape,
  InvoiceShape,
} from '../../types/billing.types';
import { AuditService } from '../audit/audit.service';
import { balanceDueDate } from '../payments/payment-schedule';
import { lirePaliers } from '../payments/refund-policy';

const AVEC_TOUT = {
  agency: true,
  pilgrim: { select: { fullName: true, phone: true, email: true } },
  package: { include: { stages: { orderBy: { startDate: 'asc' } } } },
  payments: { orderBy: { createdAt: 'asc' } },
  invoice: true,
} satisfies Prisma.BookingInclude;

type Dossier = Prisma.BookingGetPayload<{ include: typeof AVEC_TOUT }>;

// Encaissé : réussi ou remboursé ensuite (le remboursement est déduit à part).
const ENCAISSES = new Set<string>([
  PaymentStatus.SUCCEEDED,
  PaymentStatus.REFUNDED,
]);

function arrondi(montant: number): number {
  return Math.round(montant * 100) / 100;
}

/** FAC-2026-00042 */
export function numeroFacture(annee: number, sequence: number): string {
  return `FAC-${annee}-${String(sequence).padStart(5, '0')}`;
}

function vendeur(d: Dossier): BillingPartyShape {
  return {
    name: d.agency.legalName,
    address: d.agency.address ?? undefined,
    email: d.agency.contactEmail,
    phone: d.agency.contactPhone,
    taxId: d.agency.taxId ?? undefined,
    tradeRegister: d.agency.tradeRegister ?? undefined,
  };
}

function acheteur(d: Dossier): BillingPartyShape {
  return {
    name: d.pilgrim.fullName,
    email: d.pilgrim.email ?? undefined,
    phone: d.pilgrim.phone ?? undefined,
  };
}

// Idée #37 (backlog "Cent Fonctionnalités") — factures et contrats
// générés plutôt que rédigés à la main. La facture est émise une fois,
// à la première demande, avec un numéro séquentiel par agence et par
// année attribué sous verrou de l'agence (pas de doublon, pas de trou) ;
// son montant ne change plus ensuite. Le contrat est recalculé à chaque
// lecture depuis le dossier, barème de remboursement figé compris.
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getInvoice(
    userId: string,
    role: Role,
    bookingId: string,
  ): Promise<InvoiceShape> {
    let dossier = await this.dossierAutorise(userId, role, bookingId);
    if (!dossier.invoice) {
      await this.emettre(dossier);
      await this.auditService.record({
        actorId: userId,
        actorRole: role,
        action: 'invoice.issue',
        entityType: 'booking',
        entityId: bookingId,
      });
      dossier = await this.dossierAutorise(userId, role, bookingId);
    }
    const facture = dossier.invoice;
    if (!facture) throw new NotFoundException('Facture introuvable');

    const encaisses = dossier.payments.filter((p) => ENCAISSES.has(p.status));
    const paid = arrondi(encaisses.reduce((s, p) => s + p.amount, 0));
    const refunded = arrondi(
      encaisses.reduce((s, p) => s + (p.refundedAmount ?? 0), 0),
    );
    return {
      number: facture.number,
      issuedAt: facture.issuedAt,
      bookingId,
      seller: vendeur(dossier),
      buyer: acheteur(dossier),
      packageTitle: dossier.package.title,
      packageType: dossier.package.type,
      startDate: dossier.package.startDate,
      endDate: dossier.package.endDate,
      totalAmount: facture.totalAmount,
      currency: facture.currency,
      payments: encaisses.map((p) => ({
        date: p.confirmedAt ?? p.createdAt,
        amount: p.amount,
        method: p.method as unknown as PaymentMethod,
        status: p.status as unknown as PaymentStatus,
        receiptRef: p.receiptRef ?? undefined,
        refundedAmount: p.refundedAmount ?? undefined,
      })),
      paid,
      refunded,
      // Réservation annulée : plus rien n'est dû.
      balanceDue:
        dossier.status === 'cancelled'
          ? 0
          : arrondi(Math.max(0, facture.totalAmount - paid + refunded)),
    };
  }

  async getContract(
    userId: string,
    role: Role,
    bookingId: string,
  ): Promise<ContractShape> {
    const d = await this.dossierAutorise(userId, role, bookingId);
    return {
      bookingId,
      generatedAt: new Date(),
      bookedAt: d.createdAt,
      agency: vendeur(d),
      pilgrim: acheteur(d),
      packageTitle: d.package.title,
      packageType: d.package.type,
      description: d.package.description ?? undefined,
      startDate: d.package.startDate,
      endDate: d.package.endDate,
      stages: d.package.stages.map((e) => ({
        city: e.city,
        hotelName: e.hotelName,
        distanceToMosqueMeters: e.distanceToMosqueMeters ?? undefined,
        startDate: e.startDate,
        endDate: e.endDate,
      })),
      inclusions: d.package.inclusions,
      price: d.package.price,
      currency: d.package.currency,
      balanceDueDate: balanceDueDate(d.package.startDate),
      refundTiers: lirePaliers(d.refundPolicySnapshot),
    };
  }

  /** Numéro suivant de l'agence pour l'année, attribué sous verrou. */
  private async emettre(d: Dossier): Promise<void> {
    const annee = new Date().getUTCFullYear();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM agencies WHERE id = ${d.agencyId} FOR UPDATE`;
        const derniere = await tx.invoice.aggregate({
          where: { agencyId: d.agencyId, year: annee },
          _max: { sequence: true },
        });
        const sequence = (derniere._max.sequence ?? 0) + 1;
        await tx.invoice.create({
          data: {
            agencyId: d.agencyId,
            bookingId: d.id,
            year: annee,
            sequence,
            number: numeroFacture(annee, sequence),
            totalAmount: d.package.price,
            currency: d.package.currency,
          },
        });
      });
    } catch (erreur) {
      // Deux demandes simultanées pour la même réservation : la seconde
      // bute sur l'unicité de bookingId — la facture existe, on la relit.
      if (
        !(erreur instanceof Prisma.PrismaClientKnownRequestError) ||
        erreur.code !== 'P2002'
      ) {
        throw erreur;
      }
    }
  }

  private async dossierAutorise(
    userId: string,
    role: Role,
    bookingId: string,
  ): Promise<Dossier> {
    const d = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: AVEC_TOUT,
    });
    if (!d) throw new NotFoundException('Réservation introuvable');
    const autorise =
      role === Role.ADMIN ||
      (role === Role.PILGRIM && d.pilgrimId === userId) ||
      (role === Role.AGENCY && d.agency.ownerId === userId);
    if (!autorise) {
      throw new ForbiddenException("Vous n'avez pas accès à cette réservation");
    }
    return d;
  }
}
