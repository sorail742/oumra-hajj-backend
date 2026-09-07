import { ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { DocumentsService } from './documents.service';
import { PilgrimDocument } from './schemas/document.schema';

describe("DocumentsService — contrôle d'accès aux documents sensibles", () => {
  let service: DocumentsService;
  let documentModel: { find: jest.Mock };
  let bookingsService: { findByIdOrFail: jest.Mock };
  let agenciesService: { findByOwnerOrFail: jest.Mock };

  const otherAgencyId = 'other-agency';
  const ownAgencyId = 'own-agency';
  const bookingId = 'booking-1';

  beforeEach(async () => {
    documentModel = {
      find: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };
    bookingsService = { findByIdOrFail: jest.fn() };
    agenciesService = { findByOwnerOrFail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getModelToken(PilgrimDocument.name),
          useValue: documentModel,
        },
        { provide: BookingsService, useValue: bookingsService },
        { provide: AgenciesService, useValue: agenciesService },
      ],
    }).compile();

    service = module.get(DocumentsService);
  });

  it("refuse à une agence l'accès aux documents d'une réservation d'une autre agence", async () => {
    bookingsService.findByIdOrFail.mockResolvedValue({
      id: bookingId,
      pilgrimId: 'pilgrim-1',
      agencyId: otherAgencyId,
    });
    agenciesService.findByOwnerOrFail.mockResolvedValue({ id: ownAgencyId });

    await expect(
      service.findByBooking('agency-owner-1', 'agency', bookingId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse à un pèlerin l'accès aux documents d'une réservation qui ne lui appartient pas", async () => {
    bookingsService.findByIdOrFail.mockResolvedValue({
      id: bookingId,
      pilgrimId: 'pilgrim-1',
      agencyId: ownAgencyId,
    });

    await expect(
      service.findByBooking('pilgrim-2', 'pilgrim', bookingId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("autorise l'agence propriétaire de la réservation à consulter les documents", async () => {
    bookingsService.findByIdOrFail.mockResolvedValue({
      id: bookingId,
      pilgrimId: 'pilgrim-1',
      agencyId: ownAgencyId,
    });
    agenciesService.findByOwnerOrFail.mockResolvedValue({ id: ownAgencyId });

    await expect(
      service.findByBooking('agency-owner-1', 'agency', bookingId),
    ).resolves.toEqual([]);
  });
});
