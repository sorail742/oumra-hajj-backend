import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { DossierStepStatus } from '../../common/enums/dossier-step-status.enum';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PackagesService } from '../packages/packages.service';
import { UsersService } from '../users/users.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    bookingStep: { update: jest.Mock };
  };
  let packagesService: {
    findByIdOrFail: jest.Mock;
    reserveSeat: jest.Mock;
    releaseSeat: jest.Mock;
  };
  let agenciesService: { findByOwnerOrFail: jest.Mock };
  let groupsService: { addMember: jest.Mock; findByIdOrFail: jest.Mock };
  let notificationsService: { send: jest.Mock; sendRawSms: jest.Mock };
  let usersService: { findByIdOrFail: jest.Mock };

  const pilgrimId = 'pilgrim-1';
  const agencyId = 'agency-1';
  const packageId = 'package-1';
  const bookingId = 'booking-1';

  const allStepsDone = () => [
    { key: DossierStepKey.PAYMENT, status: 'done', updatedAt: new Date() },
    { key: DossierStepKey.VISA, status: 'done', updatedAt: new Date() },
    { key: DossierStepKey.FLIGHT, status: 'done', updatedAt: new Date() },
    { key: DossierStepKey.VACCINATION, status: 'done', updatedAt: new Date() },
    { key: DossierStepKey.DOCUMENTS, status: 'done', updatedAt: new Date() },
  ];

  const allStepsButOneDone = () => [
    ...allStepsDone().slice(0, 4),
    { key: DossierStepKey.DOCUMENTS, status: 'pending', updatedAt: new Date() },
  ];

  const buildBooking = (
    overrides: Partial<{
      pilgrimId: string;
      agencyId: string;
      groupId: string | null;
      status: string;
      steps: { key: string; status: string; updatedAt: Date }[];
    }> = {},
  ) => ({
    id: bookingId,
    pilgrimId,
    packageId,
    agencyId,
    groupId: null,
    status: 'pending_payment',
    steps: [],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      booking: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      bookingStep: { update: jest.fn() },
    };
    packagesService = {
      findByIdOrFail: jest.fn(),
      reserveSeat: jest.fn(),
      releaseSeat: jest.fn(),
    };
    agenciesService = { findByOwnerOrFail: jest.fn() };
    groupsService = { addMember: jest.fn(), findByIdOrFail: jest.fn() };
    notificationsService = {
      send: jest.fn().mockResolvedValue([]),
      sendRawSms: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findByIdOrFail: jest
        .fn()
        .mockResolvedValue({ id: pilgrimId, fullName: 'Pèlerin Test' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: GroupsService, useValue: groupsService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  describe('create', () => {
    it('réserve une place sur le forfait avant de créer la réservation', async () => {
      packagesService.findByIdOrFail.mockResolvedValue({
        id: packageId,
        agencyId,
      });
      packagesService.reserveSeat.mockResolvedValue({});
      prisma.booking.create.mockResolvedValue(buildBooking({}));

      await service.create(pilgrimId, { packageId });

      expect(packagesService.reserveSeat).toHaveBeenCalledWith(packageId);
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ agencyId, packageId }),
        }),
      );
    });

    it("ne crée pas de réservation si la place n'a pas pu être réservée (forfait complet)", async () => {
      packagesService.findByIdOrFail.mockResolvedValue({
        id: packageId,
        agencyId,
      });
      packagesService.reserveSeat.mockRejectedValue(
        new Error('Forfait complet'),
      );

      await expect(service.create(pilgrimId, { packageId })).rejects.toThrow();
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('libère la place du forfait et passe le statut à CANCELLED', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ pilgrimId, status: 'confirmed' }),
      );
      prisma.booking.update.mockResolvedValue(
        buildBooking({ pilgrimId, status: 'cancelled' }),
      );
      packagesService.releaseSeat.mockResolvedValue({});

      const result = await service.cancel(pilgrimId, bookingId);

      expect(packagesService.releaseSeat).toHaveBeenCalledWith(packageId);
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it("refuse d'annuler la réservation d'un autre pèlerin", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ pilgrimId: 'someone-else', status: 'confirmed' }),
      );

      await expect(service.cancel(pilgrimId, bookingId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(packagesService.releaseSeat).not.toHaveBeenCalled();
    });

    it('ne libère pas la place une seconde fois si la réservation est déjà annulée', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ pilgrimId, status: 'cancelled' }),
      );
      prisma.booking.update.mockResolvedValue(
        buildBooking({ pilgrimId, status: 'cancelled' }),
      );

      await service.cancel(pilgrimId, bookingId);

      expect(packagesService.releaseSeat).not.toHaveBeenCalled();
    });
  });

  describe('updateStep', () => {
    const ownerId = 'agency-owner-1';

    it('notifie le pèlerin quand une agence marque une étape comme terminée', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ agencyId, steps: allStepsButOneDone() }),
      );
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: agencyId });
      prisma.bookingStep.update.mockResolvedValue({});

      await service.updateStep(ownerId, bookingId, {
        key: DossierStepKey.PAYMENT,
        status: DossierStepStatus.DONE,
      });

      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ recipientIds: [pilgrimId] }),
      );
    });

    it("ne notifie pas pour un changement de statut qui ne termine pas l'étape", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ agencyId, steps: allStepsButOneDone() }),
      );
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: agencyId });
      prisma.bookingStep.update.mockResolvedValue({});

      await service.updateStep(ownerId, bookingId, {
        key: DossierStepKey.VISA,
        status: DossierStepStatus.IN_PROGRESS,
      });

      expect(notificationsService.send).not.toHaveBeenCalled();
    });
  });

  describe('markStepDone — passage automatique en CONFIRMED', () => {
    it('passe la réservation à CONFIRMED quand la dernière étape se termine', async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsDone() }),
      );
      prisma.booking.update.mockResolvedValue(
        buildBooking({ steps: allStepsDone(), status: 'confirmed' }),
      );

      const result = await service.markStepDone(
        bookingId,
        DossierStepKey.DOCUMENTS,
      );

      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('reste PENDING_PAYMENT tant que toutes les étapes ne sont pas terminées', async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsButOneDone() }),
      );

      const result = await service.markStepDone(
        bookingId,
        DossierStepKey.PAYMENT,
      );

      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('notifie le pèlerin à chaque étape validée (cahier des charges §3.1)', async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsButOneDone() }),
      );

      await service.markStepDone(bookingId, DossierStepKey.PAYMENT);

      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: [pilgrimId],
          isCritical: false,
        }),
      );
    });

    it("notifie aussi le contact d'urgence par SMS (idée #29) s'il est renseigné", async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsButOneDone() }),
      );
      usersService.findByIdOrFail.mockResolvedValue({
        id: pilgrimId,
        fullName: 'Pèlerin Test',
        emergencyContact: { fullName: 'Proche', phone: '+224600000000' },
      });

      await service.markStepDone(bookingId, DossierStepKey.PAYMENT);

      expect(notificationsService.sendRawSms).toHaveBeenCalledWith(
        '+224600000000',
        expect.stringContaining('Pèlerin Test'),
      );
    });

    it("n'envoie pas de SMS famille si aucun contact d'urgence n'est renseigné", async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsButOneDone() }),
      );
      usersService.findByIdOrFail.mockResolvedValue({
        id: pilgrimId,
        fullName: 'Pèlerin Test',
      });

      await service.markStepDone(bookingId, DossierStepKey.PAYMENT);

      expect(notificationsService.sendRawSms).not.toHaveBeenCalled();
    });

    it('envoie une notification critique de confirmation quand toutes les étapes sont terminées', async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsDone() }),
      );
      prisma.booking.update.mockResolvedValue(
        buildBooking({ steps: allStepsDone(), status: 'confirmed' }),
      );

      await service.markStepDone(bookingId, DossierStepKey.DOCUMENTS);

      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ isCritical: true }),
      );
    });

    it('ne renotifie pas la confirmation si le dossier était déjà confirmé', async () => {
      prisma.bookingStep.update.mockResolvedValue({});
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ steps: allStepsDone(), status: 'confirmed' }),
      );

      await service.markStepDone(bookingId, DossierStepKey.DOCUMENTS);

      expect(prisma.booking.update).not.toHaveBeenCalled();
      // Toujours notifiée pour l'étape elle-même, jamais une 2e fois "confirmé".
      expect(notificationsService.send).toHaveBeenCalledTimes(1);
      expect(notificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ isCritical: false }),
      );
    });
  });

  describe('findAuthorizedOrFail', () => {
    it('autorise le pèlerin propriétaire de la réservation', async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking({ pilgrimId }));

      await expect(
        service.findAuthorizedOrFail(pilgrimId, Role.PILGRIM, bookingId),
      ).resolves.toBeDefined();
    });

    it('refuse un autre pèlerin', async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking({ pilgrimId }));

      await expect(
        service.findAuthorizedOrFail(
          'another-pilgrim',
          Role.PILGRIM,
          bookingId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("autorise l'admin quelle que soit la réservation", async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking({ pilgrimId }));

      await expect(
        service.findAuthorizedOrFail('admin-1', Role.ADMIN, bookingId),
      ).resolves.toBeDefined();
    });

    it("refuse une agence qui n'est pas propriétaire de la réservation", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ pilgrimId, agencyId }),
      );
      agenciesService.findByOwnerOrFail.mockResolvedValue({
        id: 'other-agency',
      });

      await expect(
        service.findAuthorizedOrFail('agency-owner', Role.AGENCY, bookingId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('countByAgencyAndStatus', () => {
    it('interroge le compte par statut avec agencyId, pas ownerId', async () => {
      prisma.booking.count.mockImplementation(({ where }) =>
        Promise.resolve(where.status === BookingStatus.COMPLETED ? 3 : 0),
      );

      const counts = await service.countByAgencyAndStatus(agencyId);

      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: { agencyId, status: BookingStatus.COMPLETED },
      });
      expect(counts[BookingStatus.COMPLETED]).toBe(3);
      expect(counts[BookingStatus.CANCELLED]).toBe(0);
    });
  });

  // Idée #28 (backlog "Cent Fonctionnalités") — espace famille simplifié.
  describe('getOrCreateFamilyViewLink', () => {
    it('renvoie le jeton existant sans le régénérer', async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking());
      prisma.booking.findUniqueOrThrow.mockResolvedValue({
        familyViewToken: 'jeton-existant',
      });

      const result = await service.getOrCreateFamilyViewLink(
        pilgrimId,
        bookingId,
      );

      expect(result.token).toBe('jeton-existant');
      expect(result.viewUrl).toBe('/api/v1/family-view/jeton-existant');
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it("génère un jeton si la réservation n'en a pas encore", async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking());
      prisma.booking.findUniqueOrThrow.mockResolvedValue({
        familyViewToken: null,
      });
      prisma.booking.update.mockResolvedValue(buildBooking());

      const result = await service.getOrCreateFamilyViewLink(
        pilgrimId,
        bookingId,
      );

      expect(result.token).toEqual(expect.any(String));
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: bookingId },
        data: { familyViewToken: result.token },
      });
    });

    it("refuse un pèlerin qui n'est pas propriétaire de la réservation", async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking());

      await expect(
        service.getOrCreateFamilyViewLink('un-autre-pelerin', bookingId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.booking.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('regenerateFamilyViewLink', () => {
    it('remplace le jeton par un nouveau', async () => {
      prisma.booking.findUnique.mockResolvedValue(buildBooking());
      prisma.booking.update.mockResolvedValue(buildBooking());

      const result = await service.regenerateFamilyViewLink(
        pilgrimId,
        bookingId,
      );

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bookingId },
          data: { familyViewToken: result.token },
        }),
      );
    });
  });

  describe('getFamilyView', () => {
    it('rejette un jeton invalide sans interroger le forfait ni le groupe', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getFamilyView('jeton-invalide')).rejects.toThrow();
      expect(packagesService.findByIdOrFail).not.toHaveBeenCalled();
    });

    it("agrège le forfait, le pèlerin, la position et la dernière étape d'itinéraire quand un groupe est rattaché", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({
          groupId: 'group-1',
          steps: allStepsDone(),
          status: 'confirmed',
        }),
      );
      packagesService.findByIdOrFail.mockResolvedValue({
        title: 'Oumra Ramadan 2027',
      });
      usersService.findByIdOrFail.mockResolvedValue({
        fullName: 'Fatoumata Diallo',
      });
      groupsService.findByIdOrFail.mockResolvedValue({
        locations: [
          {
            userId: pilgrimId,
            lat: 21.42,
            lng: 39.82,
            updatedAt: new Date('2027-03-05'),
          },
        ],
        itinerary: [
          { label: 'Arrivée à Médine', date: new Date('2027-03-01') },
          { label: 'Départ pour La Mecque', date: new Date('2027-03-05') },
        ],
      });

      const view = await service.getFamilyView('un-jeton');

      expect(view.pilgrimFullName).toBe('Fatoumata Diallo');
      expect(view.packageTitle).toBe('Oumra Ramadan 2027');
      expect(view.status).toBe('confirmed');
      expect(view.location).toEqual({
        lat: 21.42,
        lng: 39.82,
        updatedAt: new Date('2027-03-05'),
      });
      expect(view.latestItineraryStep?.label).toBe('Départ pour La Mecque');
    });

    it("n'invente ni position ni étape d'itinéraire quand la réservation n'a pas de groupe", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        buildBooking({ groupId: null }),
      );
      packagesService.findByIdOrFail.mockResolvedValue({
        title: 'Oumra Ramadan 2027',
      });
      usersService.findByIdOrFail.mockResolvedValue({
        fullName: 'Fatoumata Diallo',
      });

      const view = await service.getFamilyView('un-jeton');

      expect(view.location).toBeUndefined();
      expect(view.latestItineraryStep).toBeUndefined();
      expect(groupsService.findByIdOrFail).not.toHaveBeenCalled();
    });
  });
});
