import { BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { AccountingExportService } from './accounting-export.service';

// Montants, références et noms explicitement factices (idée #57).
function paiement(surcharge: Record<string, unknown>) {
  return {
    id: 'paiement-1',
    bookingId: 'resa-1',
    amount: 1000,
    currency: 'GNF',
    installmentNumber: 1,
    method: 'mobile_money_orange',
    status: 'succeeded',
    providerReference: 'FACTICE-REF-1',
    receiptRef: 'RCPT-paiement-1',
    confirmedAt: new Date('2026-10-03T10:00:00Z'),
    refundedAmount: null,
    refundedAt: null,
    booking: {
      pilgrim: { fullName: '[DÉMO] Pèlerin Un' },
      package: { title: '[DÉMO] Oumra fictive' },
    },
    ...surcharge,
  };
}

describe('AccountingExportService', () => {
  let findMany: jest.Mock;
  let service: AccountingExportService;
  let journal: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-20T12:00:00Z'));
    findMany = jest.fn().mockResolvedValue([]);
    service = new AccountingExportService(
      { payment: { findMany } } as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
    journal = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => {
    jest.useRealTimers();
    journal.mockRestore();
  });

  it("limite la requête à l'agence et à la période, mois courant par défaut", async () => {
    const resultat = await service.getJournal('proprietaire-1', {});

    expect(resultat.from).toBe('2026-10-01');
    expect(resultat.to).toBe('2026-10-20');
    const periode = {
      gte: new Date('2026-10-01T00:00:00Z'),
      lt: new Date('2026-10-21T00:00:00Z'),
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          booking: { agencyId: 'agence-1' },
          OR: [{ confirmedAt: periode }, { refundedAt: periode }],
        },
      }),
    );
  });

  it('produit une écriture par encaissement et par remboursement de la période, triées par date', async () => {
    findMany.mockResolvedValue([
      paiement({
        id: 'paiement-2',
        receiptRef: 'RCPT-paiement-2',
        amount: 2000,
        installmentNumber: 2,
        confirmedAt: new Date('2026-10-05T09:00:00Z'),
        status: 'refunded',
        refundedAmount: 1000,
        refundedAt: new Date('2026-10-08T09:00:00Z'),
      }),
      paiement({}),
      // Encaissé avant la période, remboursé pendant : seul le
      // remboursement compte ici.
      paiement({
        id: 'paiement-3',
        confirmedAt: new Date('2026-09-20T09:00:00Z'),
        status: 'refunded',
        refundedAmount: 500,
        refundedAt: new Date('2026-10-02T09:00:00Z'),
      }),
    ]);

    const resultat = await service.getJournal('proprietaire-1', {
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(
      resultat.entries.map((e) => [e.journal, e.pieceRef, e.debit, e.credit]),
    ).toEqual([
      ['REM', 'REMB-paiement-3', 0, 500],
      ['ENC', 'RCPT-paiement-1', 1000, 0],
      ['ENC', 'RCPT-paiement-2', 2000, 0],
      ['REM', 'REMB-paiement-2', 0, 1000],
    ]);
    expect(resultat.totalCollected).toBe(3000);
    expect(resultat.totalRefunded).toBe(1500);
    expect(resultat.net).toBe(1500);
    expect(resultat.entries[1]?.label).toBe(
      'Versement 1 — [DÉMO] Pèlerin Un — [DÉMO] Oumra fictive',
    );
  });

  it('journalise qui exporte et quelle période, sans montant ni nom', async () => {
    findMany.mockResolvedValue([paiement({})]);
    await service.getJournal('proprietaire-1', {
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(journal).toHaveBeenCalledTimes(1);
    const message = String(journal.mock.calls[0]?.[0]);
    expect(message).toContain('agence-1');
    expect(message).toContain('2026-10-01 → 2026-10-31');
    expect(message).not.toContain('1000');
    expect(message).not.toContain('Pèlerin');
  });

  it('rejette une période inversée, trop longue ou une date impossible', async () => {
    await expect(
      service.getJournal('p', { from: '2026-10-10', to: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getJournal('p', { from: '2025-01-01', to: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getJournal('p', { from: '2026-02-31', to: '2026-03-05' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('produit un CSV prêt pour Excel FR / Sage : BOM, point-virgule, date JJ/MM/AAAA, virgule décimale', async () => {
    findMany.mockResolvedValue([
      paiement({ amount: 1234.5 }),
      paiement({
        id: 'paiement-4',
        booking: {
          pilgrim: { fullName: '=HYPERLINK("x")' },
          package: { title: '[DÉMO] Hadj fictif' },
        },
      }),
    ]);

    const csv = await service.getJournalCsv('proprietaire-1', {
      from: '2026-10-01',
      to: '2026-10-31',
    });
    const [entete, premiere, seconde] = csv.split('\r\n');

    expect(csv.startsWith('﻿')).toBe(true);
    expect(entete).toContain(
      '"Date";"Journal";"N° pièce";"Libellé";"Débit";"Crédit"',
    );
    expect(premiere).toBe(
      '"03/10/2026";"ENC";"RCPT-paiement-1";"Versement 1 — [DÉMO] Pèlerin Un — [DÉMO] Oumra fictive";"1234,50";"";"GNF";"Orange Money";"FACTICE-REF-1";"resa-1";"1";"[DÉMO] Pèlerin Un";"[DÉMO] Oumra fictive"',
    );
    // Un nom saisi comme une formule reste du texte inerte.
    expect(seconde).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
