import { ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AgenciesService } from '../agencies/agencies.service';
import { GroupsService } from '../groups/groups.service';
import { PackagesService } from '../packages/packages.service';
import { Role } from '../../common/enums/role.enum';
import { BookingsService } from './bookings.service';
import {
  Booking,
  BookingStatus,
  DossierStepKey,
  DossierStepStatus,
} from './schemas/booking.schema';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingModel: { create: jest.Mock; findById: jest.Mock };
  let packagesService: {
    findByIdOrFail: jest.Mock;
    reserveSeat: jest.Mock;
    releaseSeat: jest.Mock;
  };
  let agenciesService: { findByOwnerOrFail: jest.Mock };
  let groupsService: { addMember: jest.Mock };

  const pilgrimId = new Types.ObjectId().toString();
  const agencyId = 'agency-1';
  const packageId = new Types.ObjectId().toString();
  const bookingId = new Types.ObjectId().toString();

  beforeEach(async () => {
    bookingModel = { create: jest.fn(), findById: jest.fn() };
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
        { provide: getModelToken(Booking.name), useValue: bookingModel },
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
        _id: new Types.ObjectId(packageId),
        agency: agencyId,
      });
      packagesService.reserveSeat.mockResolvedValue({});
      bookingModel.create.mockResolvedValue({ _id: bookingId });

      await service.create(pilgrimId, { packageId });

      expect(packagesService.reserveSeat).toHaveBeenCalledWith(packageId);
      expect(bookingModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ agency: agencyId }),
      );
    });

    it("ne crée pas de réservation si la place n'a pas pu être réservée (forfait complet)", async () => {
      packagesService.findByIdOrFail.mockResolvedValue({
        _id: new Types.ObjectId(packageId),
        agency: agencyId,
      });
      packagesService.reserveSeat.mockRejectedValue(
        new Error('Forfait complet'),
      );

      await expect(service.create(pilgrimId, { packageId })).rejects.toThrow();
      expect(bookingModel.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('libère la place du forfait et passe le statut à CANCELLED', async () => {
      const booking = {
        pilgrim: { toString: () => pilgrimId },
        package: { toString: () => packageId },
        status: BookingStatus.CONFIRMED,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      });
      packagesService.releaseSeat.mockResolvedValue({});

      const result = await service.cancel(pilgrimId, bookingId);

      expect(packagesService.releaseSeat).toHaveBeenCalledWith(packageId);
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it("refuse d'annuler la réservation d'un autre pèlerin", async () => {
      const booking = {
        pilgrim: { toString: () => 'someone-else' },
        package: { toString: () => packageId },
        status: BookingStatus.CONFIRMED,
        save: jest.fn(),
      };
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      });

      await expect(service.cancel(pilgrimId, bookingId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(packagesService.releaseSeat).not.toHaveBeenCalled();
    });

    it('ne libère pas la place une seconde fois si la réservation est déjà annulée', async () => {
      const booking = {
        pilgrim: { toString: () => pilgrimId },
        package: { toString: () => packageId },
        status: BookingStatus.CANCELLED,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      });

      await service.cancel(pilgrimId, bookingId);

      expect(packagesService.releaseSeat).not.toHaveBeenCalled();
    });
  });

  describe('markStepDone / updateStep — passage automatique en CONFIRMED', () => {
    const allStepsButOneDone = () => [
      {
        key: DossierStepKey.PAYMENT,
        status: DossierStepStatus.DONE,
        updatedAt: new Date(),
      },
      {
        key: DossierStepKey.VISA,
        status: DossierStepStatus.DONE,
        updatedAt: new Date(),
      },
      {
        key: DossierStepKey.FLIGHT,
        status: DossierStepStatus.DONE,
        updatedAt: new Date(),
      },
      {
        key: DossierStepKey.VACCINATION,
        status: DossierStepStatus.DONE,
        updatedAt: new Date(),
      },
      {
        key: DossierStepKey.DOCUMENTS,
        status: DossierStepStatus.PENDING,
        updatedAt: new Date(),
      },
    ];

    it('passe la réservation à CONFIRMED quand la dernière étape se termine', async () => {
      const booking = {
        steps: allStepsButOneDone(),
        status: BookingStatus.PENDING_PAYMENT,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      });

      const result = await service.markStepDone(
        bookingId,
        DossierStepKey.DOCUMENTS,
      );

      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('reste PENDING_PAYMENT tant que toutes les étapes ne sont pas terminées', async () => {
      const steps = allStepsButOneDone();
      const booking = {
        steps,
        status: BookingStatus.PENDING_PAYMENT,
        save: jest.fn().mockImplementation(function (this: unknown) {
          return Promise.resolve(this);
        }),
      };
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      });

      // Termine une étape qui n'est pas la dernière restante : DOCUMENTS reste PENDING.
      const result = await service.markStepDone(
        bookingId,
        DossierStepKey.PAYMENT,
      );

      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
    });
  });

  describe('findAuthorizedOrFail', () => {
    const makeBooking = () => ({
      pilgrim: { toString: () => pilgrimId },
      agency: agencyId,
    });

    it('autorise le pèlerin propriétaire de la réservation', async () => {
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(makeBooking()),
      });

      await expect(
        service.findAuthorizedOrFail(pilgrimId, Role.PILGRIM, bookingId),
      ).resolves.toBeDefined();
    });

    it('refuse un autre pèlerin', async () => {
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(makeBooking()),
      });

      await expect(
        service.findAuthorizedOrFail(
          'another-pilgrim',
          Role.PILGRIM,
          bookingId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("autorise l'admin quelle que soit la réservation", async () => {
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(makeBooking()),
      });

      await expect(
        service.findAuthorizedOrFail('admin-1', Role.ADMIN, bookingId),
      ).resolves.toBeDefined();
    });

    it("refuse une agence qui n'est pas propriétaire de la réservation", async () => {
      bookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(makeBooking()),
      });
      agenciesService.findByOwnerOrFail.mockResolvedValue({
        id: 'other-agency',
      });

      await expect(
        service.findAuthorizedOrFail('agency-owner', Role.AGENCY, bookingId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
