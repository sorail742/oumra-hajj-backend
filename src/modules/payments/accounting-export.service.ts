import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { BOM_UTF8, celluleCsv } from '../../common/utils/csv';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AccountingEntryShape,
  AccountingExportShape,
} from '../../types/payment.types';
import { AgenciesService } from '../agencies/agencies.service';
import { AccountingExportQueryDto } from './dto/accounting-export-query.dto';

const DEVISE_PAR_DEFAUT = 'GNF';
const JOUR_MS = 24 * 60 * 60 * 1000;
// Un exercice, plus une marge pour une année bissextile.
const PERIODE_MAX_JOURS = 366;

const LIBELLE_MOYEN: Record<PaymentMethod, string> = {
  [PaymentMethod.MOBILE_MONEY_ORANGE]: 'Orange Money',
  [PaymentMethod.MOBILE_MONEY_MTN]: 'MTN Mobile Money',
  [PaymentMethod.CARD]: 'Carte bancaire',
};

/** AAAA-MM-JJ → minuit UTC (la Guinée est à UTC+0). */
function jour(valeur: string): Date {
  const date = new Date(`${valeur}T00:00:00.000Z`);
  // Un 31 février deviendrait silencieusement un 3 mars : refusé.
  if (Number.isNaN(date.getTime()) || versJour(date) !== valeur) {
    throw new BadRequestException(`Date invalide : ${valeur}`);
  }
  return date;
}

function versJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** JJ/MM/AAAA : format de date lu tel quel par Excel FR et Sage. */
function dateFr(date: Date): string {
  const [annee, mois, jj] = versJour(date).split('-');
  return `${jj}/${mois}/${annee}`;
}

/** Virgule décimale, sans séparateur de milliers : importable sans retouche. */
function montantFr(montant: number): string {
  return montant === 0 ? '' : montant.toFixed(2).replace('.', ',');
}

function arrondi(montant: number): number {
  return Math.round(montant * 100) / 100;
}

// Idée #57 (backlog "Cent Fonctionnalités") — export comptable local :
// journal des encaissements et remboursements de l'agence sur une
// période, structuré pour un import Sage ou un tableur (date, journal,
// pièce, libellé, débit, crédit) plutôt qu'un CSV brut à retravailler.
// Les montants viennent tels quels de la base, confirmés par le
// prestataire — jamais recalculés. Chaque export est journalisé (qui,
// quelle période, combien de lignes), jamais son contenu (ADR 0008).
@Injectable()
export class AccountingExportService {
  private readonly accessLogger = new Logger('AccountingExport');

  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async getJournal(
    ownerId: string,
    query: AccountingExportQueryDto,
  ): Promise<AccountingExportShape> {
    const agency = await this.agenciesService.findByOwnerOrFail(ownerId);
    const { from, to } = this.periode(query);
    const debut = jour(from);
    const finExclue = new Date(jour(to).getTime() + JOUR_MS);
    const dansPeriode = { gte: debut, lt: finExclue };

    const paiements = await this.prisma.payment.findMany({
      where: {
        booking: { agencyId: agency.id },
        OR: [{ confirmedAt: dansPeriode }, { refundedAt: dansPeriode }],
      },
      include: {
        booking: {
          select: {
            pilgrim: { select: { fullName: true } },
            package: { select: { title: true } },
          },
        },
      },
    });

    const entries: AccountingEntryShape[] = [];
    for (const p of paiements) {
      const commun = {
        currency: p.currency,
        method: p.method as unknown as PaymentMethod,
        providerReference: p.providerReference,
        bookingId: p.bookingId,
        installmentNumber: p.installmentNumber,
        pilgrimName: p.booking.pilgrim.fullName,
        packageTitle: p.booking.package.title,
      };
      const tiers = `${commun.pilgrimName} — ${commun.packageTitle}`;
      if (
        p.confirmedAt &&
        p.confirmedAt >= debut &&
        p.confirmedAt < finExclue
      ) {
        entries.push({
          ...commun,
          date: p.confirmedAt,
          journal: 'ENC',
          pieceRef: p.receiptRef ?? `RCPT-${p.id}`,
          label: `Versement ${p.installmentNumber} — ${tiers}`,
          debit: p.amount,
          credit: 0,
        });
      }
      if (
        p.refundedAt &&
        p.refundedAmount &&
        p.refundedAt >= debut &&
        p.refundedAt < finExclue
      ) {
        entries.push({
          ...commun,
          date: p.refundedAt,
          journal: 'REM',
          pieceRef: `REMB-${p.id}`,
          label: `Remboursement versement ${p.installmentNumber} — ${tiers}`,
          debit: 0,
          credit: p.refundedAmount,
        });
      }
    }
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const totalCollected = arrondi(entries.reduce((s, e) => s + e.debit, 0));
    const totalRefunded = arrondi(entries.reduce((s, e) => s + e.credit, 0));
    this.accessLogger.log(
      `Export comptable — agence ${agency.id}, période ${from} → ${to}, ${entries.length} écriture(s)`,
    );
    return {
      from,
      to,
      currency: entries[0]?.currency ?? DEVISE_PAR_DEFAUT,
      totalCollected,
      totalRefunded,
      net: arrondi(totalCollected - totalRefunded),
      entries,
    };
  }

  async getJournalCsv(
    ownerId: string,
    query: AccountingExportQueryDto,
  ): Promise<string> {
    const journal = await this.getJournal(ownerId, query);
    // Point-virgule : séparateur attendu par Excel en paramètres
    // régionaux français, et accepté par l'import paramétrable de Sage.
    const entete = [
      'Date',
      'Journal',
      'N° pièce',
      'Libellé',
      'Débit',
      'Crédit',
      'Devise',
      'Moyen de paiement',
      'Référence prestataire',
      'Réservation',
      'Versement',
      'Pèlerin',
      'Forfait',
    ]
      .map(celluleCsv)
      .join(';');
    const lignes = journal.entries.map((e) =>
      [
        dateFr(e.date),
        e.journal,
        e.pieceRef,
        e.label,
        montantFr(e.debit),
        montantFr(e.credit),
        e.currency,
        LIBELLE_MOYEN[e.method] ?? e.method,
        e.providerReference,
        e.bookingId,
        String(e.installmentNumber),
        e.pilgrimName,
        e.packageTitle,
      ]
        .map(celluleCsv)
        .join(';'),
    );
    return `${BOM_UTF8}${[entete, ...lignes].join('\r\n')}`;
  }

  /** Période demandée, ou le mois en cours jusqu'à aujourd'hui. */
  private periode(query: AccountingExportQueryDto): {
    from: string;
    to: string;
  } {
    const aujourdhui = versJour(new Date());
    const from = query.from ?? `${aujourdhui.slice(0, 8)}01`;
    const to = query.to ?? aujourdhui;
    const ecart = (jour(to).getTime() - jour(from).getTime()) / JOUR_MS;
    if (ecart < 0) {
      throw new BadRequestException(
        'La date de début doit précéder la date de fin',
      );
    }
    if (ecart >= PERIODE_MAX_JOURS) {
      throw new BadRequestException(
        `Période limitée à ${PERIODE_MAX_JOURS} jours par export`,
      );
    }
    return { from, to };
  }
}
