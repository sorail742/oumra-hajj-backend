import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService, numeroFacture } from './billing.service';

// Dossier explicitement factice (idée #37).
const RESA = '33333333-3333-4333-8333-333333333333';

function dossier(surcharge: Record<string, unknown> = {}) {
  return {
    id: RESA,
    pilgrimId: 'pelerin-1',
    agencyId: 'agence-1',
    status: 'confirmed',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    refundPolicySnapshot: [{ minDaysBeforeDeparture: 30, rate: 0.5 }],
    agency: {
      ownerId: 'proprio-1',
      legalName: '[DÉMO] Agence fictive',
      address: 'Conakry',
      contactEmail: 'agence@demo.test',
      contactPhone: '+224600000000',
      taxId: 'NIF-FACTICE',
      tradeRegister: null,
    },
    pilgrim: { fullName: '[DÉMO] Pèlerin', phone: null, email: 'p@demo.test' },
    package: {
      title: '[DÉMO] Oumra fictive',
      type: 'oumra',
      description: null,
      startDate: new Date('2026-12-01T00:00:00Z'),
      endDate: new Date('2026-12-15T00:00:00Z'),
      price: 3000,
      currency: 'GNF',
      inclusions: ['Vol', 'Hôtel'],
      stages: [],
    },
    payments: [
      {
        amount: 1000,
        status: 'succeeded',
        method: 'card',
        confirmedAt: new Date('2026-09-02T00:00:00Z'),
        createdAt: new Date('2026-09-02T00:00:00Z'),
        receiptRef: 'RCPT-1',
        refundedAmount: null,
      },
      {
        amount: 500,
        status: 'refunded',
        method: 'card',
        confirmedAt: new Date('2026-09-03T00:00:00Z'),
        createdAt: new Date('2026-09-03T00:00:00Z'),
        receiptRef: 'RCPT-2',
        refundedAmount: 250,
      },
      {
        amount: 9999,
        status: 'failed',
        method: 'card',
        confirmedAt: null,
        createdAt: new Date('2026-09-04T00:00:00Z'),
        receiptRef: null,
        refundedAmount: null,
      },
    ],
    invoice: null as unknown,
    ...surcharge,
  };
}

const FACTURE = {
  number: 'FAC-2026-00007',
  issuedAt: new Date('2026-10-08T00:00:00Z'),
  totalAmount: 3000,
  currency: 'GNF',
};

describe('BillingService', () => {
  let prisma: {
    booking: { findUnique: jest.Mock };
    invoice: { aggregate: jest.Mock; create: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let record: jest.Mock;
  let service: BillingService;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: 6 } }),
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    record = jest.fn();
    service = new BillingService(
      prisma as unknown as PrismaService,
      { record } as unknown as AuditService,
    );
  });

  it('numérote FAC-AAAA-NNNNN', () => {
    expect(numeroFacture(2026, 42)).toBe('FAC-2026-00042');
  });

  it("émet la facture à la première demande : numéro suivant sous verrou de l'agence, tracé", async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(dossier())
      .mockResolvedValueOnce(dossier({ invoice: FACTURE }));

    const facture = await service.getInvoice('pelerin-1', Role.PILGRIM, RESA);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agencyId: 'agence-1',
        bookingId: RESA,
        sequence: 7,
        number: expect.stringMatching(/^FAC-\d{4}-00007$/),
        totalAmount: 3000,
      }),
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice.issue', entityId: RESA }),
    );
    expect(facture.number).toBe('FAC-2026-00007');
    // Encaissé 1 500, remboursé 250 : reste 1 750 ; l'échec est ignoré.
    expect(facture.payments).toHaveLength(2);
    expect(facture.paid).toBe(1500);
    expect(facture.refunded).toBe(250);
    expect(facture.balanceDue).toBe(1750);
    expect(facture.seller.taxId).toBe('NIF-FACTICE');
  });

  it('relit une facture déjà émise sans nouveau numéro', async () => {
    prisma.booking.findUnique.mockResolvedValue(dossier({ invoice: FACTURE }));
    await service.getInvoice('proprio-1', Role.AGENCY, RESA);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('tolère deux émissions simultanées (unicité par réservation)', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(dossier())
      .mockResolvedValueOnce(dossier({ invoice: FACTURE }));
    prisma.invoice.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('doublon', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.getInvoice('pelerin-1', Role.PILGRIM, RESA),
    ).resolves.toMatchObject({ number: 'FAC-2026-00007' });
  });

  it("refuse la réservation d'un autre pèlerin ou d'une autre agence", async () => {
    prisma.booking.findUnique.mockResolvedValue(dossier({ invoice: FACTURE }));
    await expect(
      service.getInvoice('pelerin-2', Role.PILGRIM, RESA),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getContract('proprio-2', Role.AGENCY, RESA),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("n'affiche plus de solde dû sur une réservation annulée", async () => {
    prisma.booking.findUnique.mockResolvedValue(
      dossier({ status: 'cancelled', invoice: FACTURE }),
    );
    const facture = await service.getInvoice('pelerin-1', Role.PILGRIM, RESA);
    expect(facture.balanceDue).toBe(0);
  });

  it('établit le contrat avec le barème figé et la date limite du solde', async () => {
    prisma.booking.findUnique.mockResolvedValue(dossier());
    const contrat = await service.getContract('pelerin-1', Role.PILGRIM, RESA);
    expect(contrat.refundTiers).toEqual([
      { minDaysBeforeDeparture: 30, rate: 0.5 },
    ]);
    expect(contrat.balanceDueDate).toEqual(new Date('2026-11-01T00:00:00Z'));
    expect(contrat.inclusions).toEqual(['Vol', 'Hôtel']);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});
