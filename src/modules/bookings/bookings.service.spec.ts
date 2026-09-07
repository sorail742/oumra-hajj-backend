import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { DossierStepKey } from '../../common/enums/dossier-step-key.enum';
import { Role } from '../../common/enums/role.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { GroupsService } from '../groups/groups.service';
import { PackagesService } from '../packages/packages.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      create: jest.Mock;
      findUnique: jest.Mock;
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
  let groupsService: { addMember: jest.Mock };

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
      status: string;
      steps: { key: string; status: string; updatedAt: Date }[];
    }>,
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
    groupsService = { addMember: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PackagesService, useValue: packagesService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: GroupsService, useValue: groupsService },
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
});
