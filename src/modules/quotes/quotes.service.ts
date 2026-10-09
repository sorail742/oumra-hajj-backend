import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuoteStatus as PrismaQuoteStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QuoteClientType,
  QuoteShape,
  QuoteStatus,
  SharedQuoteShape,
} from '../../types/quote.types';
import { AgenciesService } from '../agencies/agencies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { calculerTotaux, numeroDevis } from './quote-totals';

const JOUR_MS = 24 * 60 * 60 * 1000;
// Au-delà, les prix d'un voyage ne sont plus tenables.
export const MAX_VALIDITY_DAYS = 365;

const statut = (s: QuoteStatus) => s as unknown as PrismaQuoteStatus;

const COMPLET = {
  package: { select: { title: true } },
  lines: { orderBy: { position: 'asc' } },
} satisfies Prisma.QuoteInclude;

type Devis = Prisma.QuoteGetPayload<{ include: typeof COMPLET }>;

function expire(d: { status: PrismaQuoteStatus; validUntil: Date }): boolean {
  return (
    d.status === statut(QuoteStatus.SENT) && d.validUntil.getTime() < Date.now()
  );
}

function totaux(d: Devis) {
  return {
    currency: d.currency,
    lines: d.lines.map((l) => ({
      label: l.label,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      total: l.total,
    })),
    subtotal: d.subtotal,
    discountRate: d.discountRate,
    discountAmount: d.discountAmount,
    totalAmount: d.totalAmount,
  };
}

function toQuoteShape(d: Devis): QuoteShape {
  return {
    id: d.id,
    number: d.number,
    packageId: d.packageId ?? undefined,
    packageTitle: d.package?.title,
    clientName: d.clientName,
    clientType: d.clientType as QuoteClientType,
    contactName: d.contactName,
    contactPhone: d.contactPhone ?? undefined,
    contactEmail: d.contactEmail ?? undefined,
    pilgrimsCount: d.pilgrimsCount,
    ...totaux(d),
    conditions: d.conditions ?? undefined,
    validUntil: d.validUntil,
    status: d.status as unknown as QuoteStatus,
    expired: expire(d),
    shareToken: d.shareToken ?? undefined,
    sentAt: d.sentAt ?? undefined,
    respondedAt: d.respondedAt ?? undefined,
    createdAt: d.createdAt,
  };
}

function verifierValidite(validUntil: Date): void {
  const ecart = validUntil.getTime() - Date.now();
  if (ecart <= 0) {
    throw new BadRequestException('La date de validité doit être à venir');
  }
  if (ecart > MAX_VALIDITY_DAYS * JOUR_MS) {
    throw new BadRequestException(
      `Un devis reste valable ${MAX_VALIDITY_DAYS} jours au plus`,
    );
  }
}

// Idée #49 (backlog "Cent Fonctionnalités") — devis pour un groupe
// (entreprise, mosquée, association) : l'agence le prépare en brouillon,
// l'envoie — il est alors figé et un lien à jeton est créé —, le client
// l'accepte ou le refuse par ce lien, sans compte, tant qu'il est valable.
// Totaux recalculés ici à chaque écriture ; numéro attribué sous verrou
// de l'agence, sans doublon ni trou (même principe que les factures).
@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenciesService: AgenciesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(
    ownerId: string,
    query: ListQuotesQueryDto,
  ): Promise<QuoteShape[]> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const devis = await this.prisma.quote.findMany({
      where: {
        agencyId: agence.id,
        ...(query.status && { status: statut(query.status) }),
      },
      include: COMPLET,
      orderBy: { createdAt: 'desc' },
    });
    return devis.map(toQuoteShape);
  }

  async get(ownerId: string, id: string): Promise<QuoteShape> {
    return toQuoteShape(await this.findOwnedOrFail(ownerId, id));
  }

  async create(ownerId: string, dto: CreateQuoteDto): Promise<QuoteShape> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    await this.agenciesService.assertApproved(agence.id);
    const validUntil = new Date(dto.validUntil);
    verifierValidite(validUntil);
    let currency = dto.currency ?? 'GNF';
    if (dto.packageId) {
      const forfait = await this.prisma.package.findUnique({
        where: { id: dto.packageId },
        select: { agencyId: true, currency: true },
      });
      if (!forfait) throw new NotFoundException('Forfait introuvable');
      if (forfait.agencyId !== agence.id) {
        throw new ForbiddenException(
          "Ce forfait n'appartient pas à votre agence",
        );
      }
      currency = forfait.currency;
    }
    const t = calculerTotaux(dto.lines, dto.discountRate ?? 0, currency);
    const annee = new Date().getUTCFullYear();
    const id = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM agencies WHERE id = ${agence.id} FOR UPDATE`;
      const dernier = await tx.quote.aggregate({
        where: { agencyId: agence.id, year: annee },
        _max: { sequence: true },
      });
      const sequence = (dernier._max.sequence ?? 0) + 1;
      const cree = await tx.quote.create({
        data: {
          agencyId: agence.id,
          packageId: dto.packageId,
          year: annee,
          sequence,
          number: numeroDevis(annee, sequence),
          clientName: dto.clientName.trim(),
          clientType: dto.clientType,
          contactName: dto.contactName.trim(),
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          pilgrimsCount: dto.pilgrimsCount,
          currency: t.currency,
          discountRate: t.discountRate,
          subtotal: t.subtotal,
          discountAmount: t.discountAmount,
          totalAmount: t.totalAmount,
          conditions: dto.conditions?.trim() || undefined,
          validUntil,
          lines: {
            create: t.lines.map((l, position) => ({ ...l, position })),
          },
        },
        select: { id: true },
      });
      return cree.id;
    });
    return this.get(ownerId, id);
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateQuoteDto,
  ): Promise<QuoteShape> {
    const actuel = await this.findOwnedOrFail(ownerId, id);
    this.assertDraft(actuel);
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : actuel.validUntil;
    verifierValidite(validUntil);
    const t = calculerTotaux(
      dto.lines ?? actuel.lines,
      dto.discountRate ?? actuel.discountRate,
      actuel.currency,
    );
    await this.prisma.$transaction([
      this.prisma.quoteLine.deleteMany({ where: { quoteId: id } }),
      this.prisma.quote.update({
        where: { id },
        data: {
          clientName: dto.clientName?.trim(),
          clientType: dto.clientType,
          contactName: dto.contactName?.trim(),
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          pilgrimsCount: dto.pilgrimsCount,
          discountRate: t.discountRate,
          subtotal: t.subtotal,
          discountAmount: t.discountAmount,
          totalAmount: t.totalAmount,
          conditions:
            dto.conditions === undefined
              ? undefined
              : dto.conditions.trim() || null,
          validUntil,
          lines: {
            create: t.lines.map((l, position) => ({ ...l, position })),
          },
        },
      }),
    ]);
    return this.get(ownerId, id);
  }

  /** Fige le devis et crée le lien à transmettre au client. */
  async send(ownerId: string, id: string): Promise<QuoteShape> {
    const actuel = await this.findOwnedOrFail(ownerId, id);
    this.assertDraft(actuel);
    verifierValidite(actuel.validUntil);
    const envoye = await this.prisma.quote.update({
      where: { id },
      data: {
        status: statut(QuoteStatus.SENT),
        shareToken: randomBytes(24).toString('hex'),
        sentAt: new Date(),
      },
      include: COMPLET,
    });
    return toQuoteShape(envoye);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const actuel = await this.findOwnedOrFail(ownerId, id);
    this.assertDraft(actuel);
    await this.prisma.quote.delete({ where: { id } });
  }

  async getShared(token: string): Promise<SharedQuoteShape> {
    const d = await this.findByTokenOrFail(token);
    return {
      number: d.number,
      issuer: {
        name: d.agency.legalName,
        phone: d.agency.contactPhone,
        email: d.agency.contactEmail,
        address: d.agency.address ?? undefined,
      },
      clientName: d.clientName,
      packageTitle: d.package?.title,
      pilgrimsCount: d.pilgrimsCount,
      ...totaux(d),
      conditions: d.conditions ?? undefined,
      validUntil: d.validUntil,
      status: d.status as unknown as QuoteStatus,
      expired: expire(d),
      respondedAt: d.respondedAt ?? undefined,
    };
  }

  /** Réponse du client : une seule fois, tant que le devis est valable. */
  async respond(token: string, accept: boolean): Promise<SharedQuoteShape> {
    const d = await this.findByTokenOrFail(token);
    if (expire(d)) {
      throw new ConflictException("Ce devis n'est plus valable");
    }
    const { count } = await this.prisma.quote.updateMany({
      where: {
        id: d.id,
        status: statut(QuoteStatus.SENT),
        validUntil: { gte: new Date() },
      },
      data: {
        status: statut(accept ? QuoteStatus.ACCEPTED : QuoteStatus.DECLINED),
        respondedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('Ce devis a déjà reçu une réponse');
    }
    // Sans montant ni contact dans la notification.
    await this.notificationsService.send({
      recipientIds: [d.agency.ownerId],
      type: NotificationType.OTHER,
      title: accept ? 'Devis accepté' : 'Devis refusé',
      content: `${d.number} — ${d.clientName}`,
      isCritical: false,
    });
    return this.getShared(token);
  }

  private assertDraft(d: Devis): void {
    if (d.status !== statut(QuoteStatus.DRAFT)) {
      throw new ConflictException(
        'Un devis envoyé ne se modifie plus : créez-en un nouveau',
      );
    }
  }

  private async findOwnedOrFail(ownerId: string, id: string): Promise<Devis> {
    const agence = await this.agenciesService.findByOwnerOrFail(ownerId);
    const devis = await this.prisma.quote.findUnique({
      where: { id },
      include: COMPLET,
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.agencyId !== agence.id) {
      throw new ForbiddenException("Ce devis n'appartient pas à votre agence");
    }
    return devis;
  }

  private async findByTokenOrFail(token: string) {
    const devis = await this.prisma.quote.findUnique({
      where: { shareToken: token },
      include: {
        ...COMPLET,
        agency: {
          select: {
            legalName: true,
            contactPhone: true,
            contactEmail: true,
            address: true,
            ownerId: true,
          },
        },
      },
    });
    // Même réponse pour un jeton inconnu ou un brouillon.
    if (!devis || devis.status === statut(QuoteStatus.DRAFT)) {
      throw new NotFoundException('Devis introuvable');
    }
    return devis;
  }
}
