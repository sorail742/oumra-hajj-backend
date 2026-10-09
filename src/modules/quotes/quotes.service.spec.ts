import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { calculerTotaux, numeroDevis } from './quote-totals';
import { QuotesService } from './quotes.service';

// Données et montants explicitement factices (idée #49).
const JOUR = 24 * 60 * 60 * 1000;
const dans = (jours: number) => new Date(Date.now() + jours * JOUR);

function devis(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'devis-1',
    agencyId: 'agence-1',
    packageId: null,
    package: null,
    number: 'DEV-2026-00001',
    clientName: '[DÉMO] Mosquée fictive',
    clientType: 'mosque',
    contactName: '[DÉMO] Imam fictif',
    contactPhone: null,
    contactEmail: null,
    pilgrimsCount: 40,
    currency: 'GNF',
    discountRate: 0.1,
    subtotal: 1000,
    discountAmount: 100,
    totalAmount: 900,
    conditions: null,
    validUntil: dans(30),
    status: 'draft',
    shareToken: null,
    sentAt: null,
    respondedAt: null,
    createdAt: new Date(),
    lines: [{ label: 'Forfait', quantity: 40, unitPrice: 25, total: 1000 }],
    agency: {
      legalName: '[DÉMO] Agence',
      contactPhone: '+224600000000',
      contactEmail: 'agence@example.com',
      address: null,
      ownerId: 'proprietaire-1',
    },
    ...surcharge,
  };
}

describe('calculerTotaux', () => {
  it('calcule lignes, remise et total au centime près', () => {
    expect(
      calculerTotaux(
        [
          { label: ' Forfait ', quantity: 40, unitPrice: 1234.567 },
          { label: 'Transport', quantity: 1, unitPrice: 500 },
        ],
        0.05,
        'GNF',
      ),
    ).toEqual({
      currency: 'GNF',
      lines: [
        { label: 'Forfait', quantity: 40, unitPrice: 1234.57, total: 49382.68 },
        { label: 'Transport', quantity: 1, unitPrice: 500, total: 500 },
      ],
      subtotal: 49882.68,
      discountRate: 0.05,
      discountAmount: 2494.13,
      totalAmount: 47388.55,
    });
  });

  it('numérote sur cinq chiffres', () => {
    expect(numeroDevis(2026, 42)).toBe('DEV-2026-00042');
  });
});

describe('QuotesService', () => {
  let prisma: {
    quote: Record<string, jest.Mock>;
    quoteLine: Record<string, jest.Mock>;
    package: Record<string, jest.Mock>;
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let agences: Record<string, jest.Mock>;
  let notifications: { send: jest.Mock };
  let service: QuotesService;

  beforeEach(() => {
    prisma = {
      quote: {
        findUnique: jest.fn().mockResolvedValue(devis()),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: 6 } }),
        create: jest.fn().mockResolvedValue({ id: 'devis-1' }),
        update: jest.fn().mockResolvedValue(devis({ status: 'sent' })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
      },
      quoteLine: { deleteMany: jest.fn() },
      package: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.resolve([]),
    );
    agences = {
      findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      assertApproved: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { send: jest.fn() };
    service = new QuotesService(
      prisma as unknown as PrismaService,
      agences as unknown as AgenciesService,
      notifications as unknown as NotificationsService,
    );
  });

  const nouveau = {
    clientName: '[DÉMO] Entreprise fictive',
    clientType: 'company' as const,
    contactName: '[DÉMO] Contact',
    pilgrimsCount: 20,
    lines: [{ label: 'Forfait', quantity: 20, unitPrice: 100 }],
    discountRate: 0.1,
    validUntil: dans(30).toISOString(),
  };

  it('numérote sous verrou et calcule les totaux côté serveur', async () => {
    await service.create('proprietaire-1', nouveau);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    const data = prisma.quote.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      sequence: 7,
      number: numeroDevis(new Date().getUTCFullYear(), 7),
      currency: 'GNF',
      subtotal: 2000,
      discountAmount: 200,
      totalAmount: 1800,
    });
    expect(data.lines.create).toEqual([
      {
        label: 'Forfait',
        quantity: 20,
        unitPrice: 100,
        total: 2000,
        position: 0,
      },
    ]);
  });

  it("reprend la devise du forfait et refuse celui d'une autre agence", async () => {
    prisma.package.findUnique.mockResolvedValue({
      agencyId: 'agence-1',
      currency: 'XOF',
    });
    await service.create('proprietaire-1', {
      ...nouveau,
      packageId: 'forfait-1',
      currency: 'EUR',
    });
    expect(prisma.quote.create.mock.calls[0][0].data.currency).toBe('XOF');

    prisma.package.findUnique.mockResolvedValue({
      agencyId: 'agence-2',
      currency: 'GNF',
    });
    await expect(
      service.create('proprietaire-1', { ...nouveau, packageId: 'forfait-9' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse une validité passée ou de plus d’un an', async () => {
    for (const jours of [-1, 400]) {
      await expect(
        service.create('proprietaire-1', {
          ...nouveau,
          validUntil: dans(jours).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("ne modifie ni n'envoie un devis déjà envoyé", async () => {
    prisma.quote.findUnique.mockResolvedValue(devis({ status: 'sent' }));
    await expect(
      service.update('proprietaire-1', 'devis-1', { pilgrimsCount: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.send('proprietaire-1', 'devis-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('recalcule les totaux à la modification avec la devise enregistrée', async () => {
    await service.update('proprietaire-1', 'devis-1', { discountRate: 0 });
    const data = prisma.quote.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      subtotal: 1000,
      discountAmount: 0,
      totalAmount: 1000,
    });
    expect(prisma.quoteLine.deleteMany).toHaveBeenCalledWith({
      where: { quoteId: 'devis-1' },
    });
  });

  it("refuse le devis d'une autre agence", async () => {
    prisma.quote.findUnique.mockResolvedValue(devis({ agencyId: 'agence-2' }));
    await expect(
      service.get('proprietaire-1', 'devis-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("crée un jeton à l'envoi", async () => {
    await service.send('proprietaire-1', 'devis-1');
    const data = prisma.quote.update.mock.calls[0][0].data;
    expect(data.status).toBe('sent');
    expect(data.shareToken).toMatch(/^[0-9a-f]{48}$/);
  });

  describe('lien client', () => {
    it("cache un brouillon et n'expose pas les contacts saisis", async () => {
      await expect(service.getShared('jeton')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.quote.findUnique.mockResolvedValue(
        devis({ status: 'sent', shareToken: 'jeton', contactPhone: '+224611' }),
      );
      const vue = await service.getShared('jeton');
      expect(vue.issuer.name).toBe('[DÉMO] Agence');
      expect(vue).not.toHaveProperty('contactPhone');
      expect(vue).not.toHaveProperty('shareToken');
    });

    it("accepte une fois et prévient l'agence sans montant", async () => {
      prisma.quote.findUnique.mockResolvedValue(
        devis({ status: 'sent', shareToken: 'jeton' }),
      );
      await service.respond('jeton', true);
      expect(prisma.quote.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 'devis-1', status: 'sent' },
        data: { status: 'accepted' },
      });
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: ['proprietaire-1'],
          content: 'DEV-2026-00001 — [DÉMO] Mosquée fictive',
        }),
      );

      prisma.quote.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.respond('jeton', false)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuse une réponse après expiration', async () => {
      prisma.quote.findUnique.mockResolvedValue(
        devis({ status: 'sent', shareToken: 'jeton', validUntil: dans(-1) }),
      );
      await expect(service.respond('jeton', true)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.quote.updateMany).not.toHaveBeenCalled();
    });
  });
});
