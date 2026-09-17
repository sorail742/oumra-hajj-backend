import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PilgrimDocumentType } from '../../common/enums/pilgrim-document-type.enum';
import { AgenciesService } from '../agencies/agencies.service';
import { BookingsService } from '../bookings/bookings.service';
import { PackagesService } from '../packages/packages.service';
import { DocumentsService } from './documents.service';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';

describe("DocumentsService — contrôle d'accès aux documents sensibles", () => {
  let service: DocumentsService;
  let prisma: {
    pilgrimDocument: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let bookingsService: { findByIdOrFail: jest.Mock };
  let agenciesService: { findByOwnerOrFail: jest.Mock };
  let packagesService: { findByIdOrFail: jest.Mock };
  let storageProvider: { store: jest.Mock; getAccessUrl: jest.Mock };

  const otherAgencyId = 'other-agency';
  const ownAgencyId = 'own-agency';
  const bookingId = 'booking-1';
  const documentId = 'doc-1';

  beforeEach(async () => {
    prisma = {
      pilgrimDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    bookingsService = { findByIdOrFail: jest.fn() };
    agenciesService = { findByOwnerOrFail: jest.fn() };
    packagesService = { findByIdOrFail: jest.fn() };
    storageProvider = { store: jest.fn(), getAccessUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingsService, useValue: bookingsService },
        { provide: AgenciesService, useValue: agenciesService },
        { provide: PackagesService, useValue: packagesService },
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

  describe('getAccessUrl', () => {
    const storedDoc = {
      id: documentId,
      bookingId,
      pilgrimId: 'pilgrim-1',
      type: PilgrimDocumentType.PASSPORT,
      storageRef: 'local://documents/pilgrim-1-passport-abc.jpg',
      status: 'pending',
      rejectionReason: null,
    };

    it("refuse à un pèlerin l'accès à un document qui ne lui appartient pas", async () => {
      prisma.pilgrimDocument.findUnique.mockResolvedValue(storedDoc);
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
        agencyId: ownAgencyId,
      });

      await expect(
        service.getAccessUrl('pilgrim-2', 'pilgrim', documentId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageProvider.getAccessUrl).not.toHaveBeenCalled();
    });

    it("refuse à une agence l'accès à un document d'une autre agence", async () => {
      prisma.pilgrimDocument.findUnique.mockResolvedValue(storedDoc);
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
        agencyId: otherAgencyId,
      });
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: ownAgencyId });

      await expect(
        service.getAccessUrl('agency-owner-1', 'agency', documentId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageProvider.getAccessUrl).not.toHaveBeenCalled();
    });

    it('délègue au StorageProvider pour le pèlerin propriétaire', async () => {
      prisma.pilgrimDocument.findUnique.mockResolvedValue(storedDoc);
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
        agencyId: ownAgencyId,
      });
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      storageProvider.getAccessUrl.mockResolvedValue({
        url: '/api/v1/documents/files/token',
        expiresAt,
      });

      const result = await service.getAccessUrl(
        'pilgrim-1',
        'pilgrim',
        documentId,
      );

      expect(storageProvider.getAccessUrl).toHaveBeenCalledWith(
        storedDoc.storageRef,
      );
      expect(result).toEqual({
        url: '/api/v1/documents/files/token',
        expiresAt,
      });
    });

    it("délègue au StorageProvider pour l'agence propriétaire de la réservation", async () => {
      prisma.pilgrimDocument.findUnique.mockResolvedValue(storedDoc);
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
        agencyId: ownAgencyId,
      });
      agenciesService.findByOwnerOrFail.mockResolvedValue({ id: ownAgencyId });
      storageProvider.getAccessUrl.mockResolvedValue({
        url: '/api/v1/documents/files/token',
        expiresAt: new Date(),
      });

      await service.getAccessUrl('agency-owner-1', 'agency', documentId);

      expect(storageProvider.getAccessUrl).toHaveBeenCalledWith(
        storedDoc.storageRef,
      );
    });
  });

  // Idée #59 (backlog "Cent Fonctionnalités") — vérification croisée des
  // dates d'expiration de documents avec les dates du voyage.
  describe('getExpiryAlerts', () => {
    const now = new Date('2027-01-01T00:00:00.000Z');
    const packageId = 'package-1';

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'pilgrim-1',
        agencyId: ownAgencyId,
        packageId,
      });
      packagesService.findByIdOrFail.mockResolvedValue({
        id: packageId,
        endDate: new Date('2027-03-15T00:00:00.000Z'),
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('signale un passeport déjà expiré, un visa expirant avant le retour, un passeport expirant trop tôt après le retour, et ignore le reste', async () => {
      prisma.pilgrimDocument.findMany.mockResolvedValue([
        {
          id: 'doc-expired',
          bookingId,
          pilgrimId: 'pilgrim-1',
          type: PilgrimDocumentType.PASSPORT,
          storageRef: 'ref-1',
          status: 'validated',
          rejectionReason: null,
          expiresAt: new Date('2026-12-01T00:00:00.000Z'), // passé
        },
        {
          id: 'doc-before-trip',
          bookingId,
          pilgrimId: 'pilgrim-1',
          type: PilgrimDocumentType.VISA,
          storageRef: 'ref-2',
          status: 'validated',
          rejectionReason: null,
          expiresAt: new Date('2027-03-01T00:00:00.000Z'), // avant la fin du voyage (15/03)
        },
        {
          id: 'doc-passport-soon-after',
          bookingId,
          pilgrimId: 'pilgrim-1',
          type: PilgrimDocumentType.PASSPORT,
          storageRef: 'ref-3',
          status: 'validated',
          rejectionReason: null,
          // Fin du voyage + ~1 mois, sous la marge de 6 mois exigée.
          expiresAt: new Date('2027-04-15T00:00:00.000Z'),
        },
        {
          id: 'doc-passport-far',
          bookingId,
          pilgrimId: 'pilgrim-1',
          type: PilgrimDocumentType.PASSPORT,
          storageRef: 'ref-4',
          status: 'validated',
          rejectionReason: null,
          // Largement au-delà de la marge de 6 mois après le voyage.
          expiresAt: new Date('2028-01-01T00:00:00.000Z'),
        },
        {
          id: 'doc-no-expiry',
          bookingId,
          pilgrimId: 'pilgrim-1',
          type: PilgrimDocumentType.FLIGHT_TICKET,
          storageRef: 'ref-5',
          status: 'validated',
          rejectionReason: null,
          expiresAt: null,
        },
      ]);

      const alerts = await service.getExpiryAlerts(
        'pilgrim-1',
        'pilgrim',
        bookingId,
      );

      expect(alerts).toEqual([
        {
          id: 'doc-expired',
          type: PilgrimDocumentType.PASSPORT,
          expiresAt: new Date('2026-12-01T00:00:00.000Z'),
          status: 'expired',
        },
        {
          id: 'doc-before-trip',
          type: PilgrimDocumentType.VISA,
          expiresAt: new Date('2027-03-01T00:00:00.000Z'),
          status: 'expires_before_trip',
        },
        {
          id: 'doc-passport-soon-after',
          type: PilgrimDocumentType.PASSPORT,
          expiresAt: new Date('2027-04-15T00:00:00.000Z'),
          status: 'expires_soon_after_trip',
        },
      ]);
    });

    it("n'applique la marge des 6 mois qu'aux passeports, pas aux visas", async () => {
      prisma.pilgrimDocument.findMany.mockResolvedValue([
        {
          id: 'doc-visa-soon-after',
          bookingId,
          pilgrimId: 'pilgrim-1',
          type: PilgrimDocumentType.VISA,
          storageRef: 'ref-1',
          status: 'validated',
          rejectionReason: null,
          // Après la fin du voyage, mais un visa n'a pas de marge de 6 mois.
          expiresAt: new Date('2027-04-15T00:00:00.000Z'),
        },
      ]);

      const alerts = await service.getExpiryAlerts(
        'pilgrim-1',
        'pilgrim',
        bookingId,
      );

      expect(alerts).toEqual([]);
    });

    it("propage le refus d'accès de findByBooking sans interroger le forfait", async () => {
      bookingsService.findByIdOrFail.mockResolvedValue({
        id: bookingId,
        pilgrimId: 'un-autre-pelerin',
        agencyId: ownAgencyId,
        packageId,
      });

      await expect(
        service.getExpiryAlerts('pilgrim-1', 'pilgrim', bookingId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(packagesService.findByIdOrFail).not.toHaveBeenCalled();
    });
  });
});
