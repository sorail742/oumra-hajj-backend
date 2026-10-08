import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus as PrismaDisputeStatus,
  Prisma,
  Role as PrismaRole,
} from '@prisma/client';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DisputeCategory,
  DisputeShape,
  DisputeStatus,
} from '../../types/dispute.types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';

// Délai laissé à l'agence pour répondre avant que le pèlerin puisse
// escalader sans réponse.
export const AGENCY_RESPONSE_DAYS = 7;
const JOUR_MS = 24 * 60 * 60 * 1000;

const ACTIFS: DisputeStatus[] = [
  DisputeStatus.OPEN,
  DisputeStatus.AGENCY_RESPONDED,
  DisputeStatus.ESCALATED,
];
// L'administration n'intervient qu'une fois l'escalade demandée : le
// dialogue pèlerin-agence reste entre eux.
const VISIBLES_ADMIN: DisputeStatus[] = [
  DisputeStatus.ESCALATED,
  DisputeStatus.CLOSED,
];

const statut = (s: DisputeStatus) => s as unknown as PrismaDisputeStatus;

const RESUME = {
  booking: { select: { package: { select: { title: true } } } },
  agency: { select: { legalName: true, ownerId: true } },
  pilgrim: { select: { fullName: true } },
} satisfies Prisma.DisputeInclude;

const DETAIL = {
  ...RESUME,
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { fullName: true } } },
  },
} satisfies Prisma.DisputeInclude;

type LitigeResume = Prisma.DisputeGetPayload<{ include: typeof RESUME }>;
type LitigeDetail = Prisma.DisputeGetPayload<{ include: typeof DETAIL }>;

function toDisputeShape(litige: LitigeResume | LitigeDetail): DisputeShape {
  return {
    id: litige.id,
    bookingId: litige.bookingId,
    packageTitle: litige.booking.package.title,
    agencyId: litige.agencyId,
    agencyName: litige.agency.legalName,
    pilgrimName: litige.pilgrim.fullName,
    category: litige.category as DisputeCategory,
    subject: litige.subject,
    status: litige.status as unknown as DisputeStatus,
    decision: litige.decision ?? undefined,
    escalatedAt: litige.escalatedAt ?? undefined,
    closedAt: litige.closedAt ?? undefined,
    createdAt: litige.createdAt,
    updatedAt: litige.updatedAt,
    escalationAvailableAt: new Date(
      litige.createdAt.getTime() + AGENCY_RESPONSE_DAYS * JOUR_MS,
    ),
    ...('messages' in litige && {
      messages: litige.messages.map((m) => ({
        id: m.id,
        authorRole: m.authorRole as unknown as Role,
        authorName: m.author.fullName,
        content: m.content,
        createdAt: m.createdAt,
      })),
    }),
  };
}

// Idée #62 (backlog "Cent Fonctionnalités") — médiation structurée : le
// pèlerin ouvre un litige sur sa réservation et dialogue d'abord avec
// l'agence ; il ne peut demander l'arbitrage de l'administration qu'après
// une réponse de l'agence, ou passé AGENCY_RESPONSE_DAYS sans réponse.
// Chaque lecture d'un litige est journalisée (qui, lequel), jamais son
// contenu (ADR 0008). Notifications sans le texte des messages.
@Injectable()
export class DisputesService {
  private readonly accessLogger = new Logger('DisputeAccess');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    pilgrimId: string,
    dto: CreateDisputeDto,
  ): Promise<DisputeShape> {
    const reservation = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { agency: { select: { ownerId: true } } },
    });
    if (!reservation || reservation.pilgrimId !== pilgrimId) {
      throw new NotFoundException('Réservation introuvable');
    }
    const enCours = await this.prisma.dispute.findFirst({
      where: { bookingId: dto.bookingId, status: { in: ACTIFS.map(statut) } },
    });
    if (enCours) {
      throw new ConflictException(
        'Un litige est déjà en cours sur cette réservation',
      );
    }
    const litige = await this.prisma.dispute.create({
      data: {
        bookingId: reservation.id,
        pilgrimId,
        agencyId: reservation.agencyId,
        category: dto.category,
        subject: dto.subject,
        messages: {
          create: {
            authorId: pilgrimId,
            authorRole: Role.PILGRIM as unknown as PrismaRole,
            content: dto.message,
          },
        },
      },
      include: DETAIL,
    });
    await this.notifier(
      [reservation.agency.ownerId],
      'Nouveau litige',
      `Un pèlerin a ouvert un litige sur une réservation. Vous avez ${AGENCY_RESPONSE_DAYS} jours pour y répondre avant qu'il puisse demander l'arbitrage de la plateforme.`,
    );
    return toDisputeShape(litige);
  }

  async list(
    userId: string,
    role: Role,
    query: ListDisputesQueryDto,
  ): Promise<DisputeShape[]> {
    const parRole: Prisma.DisputeWhereInput =
      role === Role.PILGRIM
        ? { pilgrimId: userId }
        : role === Role.AGENCY
          ? { agency: { ownerId: userId } }
          : { status: { in: VISIBLES_ADMIN.map(statut) } };
    const litiges = await this.prisma.dispute.findMany({
      where: {
        AND: [parRole, query.status ? { status: statut(query.status) } : {}],
      },
      include: RESUME,
      orderBy: { updatedAt: 'desc' },
    });
    return litiges.map(toDisputeShape);
  }

  async findOne(userId: string, role: Role, id: string): Promise<DisputeShape> {
    const litige = await this.findAuthorizedOrFail(userId, role, id);
    this.accessLogger.log(`Consultation du litige ${id} par ${role} ${userId}`);
    return toDisputeShape(litige);
  }

  async addMessage(
    userId: string,
    role: Role,
    id: string,
    content: string,
  ): Promise<DisputeShape> {
    const litige = await this.findAuthorizedOrFail(userId, role, id);
    const etat = litige.status as unknown as DisputeStatus;
    if (!ACTIFS.includes(etat)) {
      throw new ConflictException('Ce litige est clos');
    }
    // Le dialogue alterne : la réponse de l'agence passe la main au
    // pèlerin, et inversement ; une fois escaladé, l'état ne bouge plus.
    const suivant =
      etat === DisputeStatus.ESCALATED
        ? etat
        : role === Role.AGENCY
          ? DisputeStatus.AGENCY_RESPONDED
          : DisputeStatus.OPEN;
    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: statut(suivant),
        messages: {
          create: {
            authorId: userId,
            authorRole: role as unknown as PrismaRole,
            content,
          },
        },
      },
    });
    const destinataires = [
      ...(role !== Role.PILGRIM ? [litige.pilgrimId] : []),
      ...(role !== Role.AGENCY ? [litige.agency.ownerId] : []),
    ];
    await this.notifier(
      destinataires,
      'Litige : nouveau message',
      'Un nouveau message a été ajouté à un litige qui vous concerne.',
    );
    return this.findOne(userId, role, id);
  }

  /** Le pèlerin clôt à l'amiable : il est satisfait de la réponse. */
  async resolve(pilgrimId: string, id: string): Promise<DisputeShape> {
    const litige = await this.findAuthorizedOrFail(pilgrimId, Role.PILGRIM, id);
    if (!ACTIFS.includes(litige.status as unknown as DisputeStatus)) {
      throw new ConflictException('Ce litige est déjà clos');
    }
    await this.prisma.dispute.update({
      where: { id },
      data: { status: statut(DisputeStatus.RESOLVED), closedAt: new Date() },
    });
    await this.notifier(
      [litige.agency.ownerId],
      'Litige résolu',
      'Le pèlerin a clos un litige à l’amiable.',
    );
    return this.findOne(pilgrimId, Role.PILGRIM, id);
  }

  async escalate(pilgrimId: string, id: string): Promise<DisputeShape> {
    const litige = await this.findAuthorizedOrFail(pilgrimId, Role.PILGRIM, id);
    const etat = litige.status as unknown as DisputeStatus;
    const delaiEcoule =
      Date.now() - litige.createdAt.getTime() >= AGENCY_RESPONSE_DAYS * JOUR_MS;
    if (
      etat !== DisputeStatus.AGENCY_RESPONDED &&
      !(etat === DisputeStatus.OPEN && delaiEcoule)
    ) {
      throw new ConflictException(
        etat === DisputeStatus.OPEN
          ? `L'agence dispose de ${AGENCY_RESPONSE_DAYS} jours pour répondre avant toute escalade`
          : 'Ce litige ne peut plus être escaladé',
      );
    }
    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: statut(DisputeStatus.ESCALATED),
        escalatedAt: new Date(),
      },
    });
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN as unknown as PrismaRole, isActive: true },
      select: { id: true },
    });
    await this.notifier(
      [litige.agency.ownerId, ...admins.map((a) => a.id)],
      'Litige escaladé',
      "Un litige a été transmis à l'administration de la plateforme pour arbitrage.",
    );
    return this.findOne(pilgrimId, Role.PILGRIM, id);
  }

  async decide(
    adminId: string,
    id: string,
    decision: string,
  ): Promise<DisputeShape> {
    const litige = await this.findAuthorizedOrFail(adminId, Role.ADMIN, id);
    if (
      (litige.status as unknown as DisputeStatus) !== DisputeStatus.ESCALATED
    ) {
      throw new ConflictException('Seul un litige escaladé peut être arbitré');
    }
    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: statut(DisputeStatus.CLOSED),
        decision,
        decidedById: adminId,
        closedAt: new Date(),
      },
    });
    await this.notifier(
      [litige.pilgrimId, litige.agency.ownerId],
      'Décision rendue sur un litige',
      "L'administration a rendu sa décision. Consultez le litige pour la lire.",
    );
    return this.findOne(adminId, Role.ADMIN, id);
  }

  private async findAuthorizedOrFail(
    userId: string,
    role: Role,
    id: string,
  ): Promise<LitigeDetail> {
    const litige = await this.prisma.dispute.findUnique({
      where: { id },
      include: DETAIL,
    });
    if (!litige) throw new NotFoundException('Litige introuvable');
    const autorise =
      (role === Role.PILGRIM && litige.pilgrimId === userId) ||
      (role === Role.AGENCY && litige.agency.ownerId === userId) ||
      (role === Role.ADMIN &&
        VISIBLES_ADMIN.includes(litige.status as unknown as DisputeStatus));
    if (!autorise) {
      throw new ForbiddenException("Vous n'avez pas accès à ce litige");
    }
    return litige;
  }

  private async notifier(
    destinataires: string[],
    title: string,
    content: string,
  ): Promise<void> {
    if (destinataires.length === 0) return;
    await this.notificationsService.send({
      recipientIds: destinataires,
      type: NotificationType.OTHER,
      title,
      content,
      isCritical: false,
    });
  }
}
