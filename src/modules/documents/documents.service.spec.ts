import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PilgrimDocumentType } from '../../common/enums/pilgrim-document-type.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { DocumentsService } from './documents.service';
import { STORAGE_PROVIDER } from './storage/storage-provider.interface';

describe("DocumentsService — contrôle d'accès aux documents sensibles", () => {
  let service: DocumentsService;
  let prisma: {
    pilgrimDocument: { findMany: jest.Mock; create: jest.Mock };
  };
  let bookingsService: { findByIdOrFail: jest.Mock };
  let agenciesService: { findByOwnerOrFail: jest.Mock };
  let storageProvider: { store: jest.Mock };

  const otherAgencyId = 'other-agency';
  const ownAgencyId = 'own-agency';
  const bookingId = 'booking-1';

  beforeEach(async () => {
    prisma = {
      pilgrimDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };
    bookingsService = { findByIdOrFail: jest.fn() };
    agenciesService = { findByOwnerOrFail: jest.fn() };
    storageProvider = { store: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
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

  it("refuse l'upload d'un document sur une réservation qui n'appartient pas au pèlerin", async () => {
    bookingsService.findByIdOrFail.mockResolvedValue({
      id: bookingId,
      pilgrimId: 'pilgrim-1',
      agencyId: ownAgencyId,
    });

    await expect(
      service.upload(
        'pilgrim-2',
        { bookingId, type: PilgrimDocumentType.PASSPORT },
        {
          buffer: Buffer.from('x'),
          originalName: 'passeport.jpg',
          mimeType: 'image/jpeg',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storageProvider.store).not.toHaveBeenCalled();
  });

  it('délègue le fichier au StorageProvider puis enregistre la référence obtenue', async () => {
    bookingsService.findByIdOrFail.mockResolvedValue({
      id: bookingId,
      pilgrimId: 'pilgrim-1',
      agencyId: ownAgencyId,
    });
    storageProvider.store.mockResolvedValue({
      storageRef: 'local://documents/pilgrim-1-passport-abc.jpg',
    });
    prisma.pilgrimDocument.create.mockResolvedValue({
      id: 'doc-1',
      bookingId,
      pilgrimId: 'pilgrim-1',
      type: PilgrimDocumentType.PASSPORT,
      storageRef: 'local://documents/pilgrim-1-passport-abc.jpg',
      status: 'pending',
      rejectionReason: null,
    });

    const file = {
      buffer: Buffer.from('x'),
      originalName: 'passeport.jpg',
      mimeType: 'image/jpeg',
    };
    const result = await service.upload(
      'pilgrim-1',
      { bookingId, type: PilgrimDocumentType.PASSPORT },
      file,
    );

    expect(storageProvider.store).toHaveBeenCalledWith(
      'pilgrim-1',
      PilgrimDocumentType.PASSPORT,
      file,
    );
    expect(prisma.pilgrimDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageRef: 'local://documents/pilgrim-1-passport-abc.jpg',
        }),
      }),
    );
    expect(result.storageRef).toBe(
      'local://documents/pilgrim-1-passport-abc.jpg',
    );
  });
});
