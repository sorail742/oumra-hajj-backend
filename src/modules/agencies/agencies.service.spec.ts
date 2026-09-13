import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { Role } from '../../common/enums/role.enum';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import { UsersService } from '../users/users.service';
import { AgenciesService } from './agencies.service';

describe('AgenciesService — inscription et validation des agences', () => {
  let service: AgenciesService;
  let prisma: {
    agency: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    agencyLegalDocument: {
      create: jest.Mock;
    };
  };
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };
  let storageProvider: { store: jest.Mock; getAccessUrl: jest.Mock };

  const baseAgency = {
    id: 'agency-1',
    legalName: 'Agence Test',
    ownerId: 'owner-1',
    contactEmail: 'contact@agence-test.gn',
    contactPhone: '+224620000000',
    address: null,
    validationStatus: 'pending',
    rejectionReason: null,
    validatedById: null,
    validatedAt: null,
    commissionRate: 0,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    legalDocuments: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      agency: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      agencyLegalDocument: {
        create: jest.fn(),
      },
    };
    usersService = { findByEmail: jest.fn(), create: jest.fn() };
    storageProvider = { store: jest.fn(), getAccessUrl: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenciesService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
      ],
    }).compile();

    service = module.get(AgenciesService);
  });

  describe('register', () => {
    it('refuse une inscription avec un email déjà utilisé', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          legalName: 'Agence Test',
          contactEmail: 'contact@agence-test.gn',
          contactPhone: '+224620000000',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(prisma.agency.create).not.toHaveBeenCalled();
    });

    it("crée l'utilisateur agence (rôle AGENCY, mot de passe hashé) puis l'agence en statut PENDING", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ id: 'owner-1' });
      prisma.agency.create.mockResolvedValue(baseAgency);

      const agency = await service.register({
        legalName: 'Agence Test',
        contactEmail: 'contact@agence-test.gn',
        contactPhone: '+224620000000',
        password: 'password123',
      });

      const createUserArg = usersService.create.mock.calls[0][0];
      expect(createUserArg.role).toBe(Role.AGENCY);
      expect(createUserArg.passwordHash).not.toBe('password123');

      expect(prisma.agency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'owner-1',
            validationStatus: AgencyValidationStatus.PENDING,
          }),
        }),
      );
      expect(agency.id).toBe('agency-1');
      expect(agency.validationStatus).toBe(AgencyValidationStatus.PENDING);
    });
  });

  describe('assertApproved', () => {
    it("rejette une agence dont le statut n'est pas APPROVED", async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'pending',
      });

      await expect(service.assertApproved('agency-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('laisse passer une agence APPROVED', async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'approved',
      });

      await expect(service.assertApproved('agency-1')).resolves.toBeUndefined();
    });
  });

  describe('approve / reject', () => {
    it("marque l'agence APPROVED et efface un précédent motif de rejet", async () => {
      prisma.agency.update.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'approved',
        rejectionReason: null,
      });

      const result = await service.approve('agency-1', 'admin-1');

      expect(prisma.agency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agency-1' },
          data: expect.objectContaining({
            validationStatus: AgencyValidationStatus.APPROVED,
            validatedById: 'admin-1',
            rejectionReason: null,
          }),
        }),
      );
      expect(result.validationStatus).toBe(AgencyValidationStatus.APPROVED);
      expect(result.rejectionReason).toBeUndefined();
    });

    it("marque l'agence REJECTED avec le motif fourni", async () => {
      prisma.agency.update.mockResolvedValue({
        ...baseAgency,
        validationStatus: 'rejected',
        rejectionReason: 'documents illisibles',
      });

      const result = await service.reject(
        'agency-1',
        'admin-1',
        'documents illisibles',
      );

      expect(result.validationStatus).toBe(AgencyValidationStatus.REJECTED);
      expect(result.rejectionReason).toBe('documents illisibles');
    });

    it("lève NotFoundException si l'agence n'existe pas", async () => {
      prisma.agency.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.approve('unknown', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // Idée #56 (backlog "Cent Fonctionnalités") — alertes de conformité
  // documentaire.
  describe('addLegalDocument', () => {
    it('stocke le fichier puis crée le document légal avec la date d’expiration fournie', async () => {
      prisma.agency.findUnique.mockResolvedValue(baseAgency);
      storageProvider.store.mockResolvedValue({
        storageRef: 'local://documents/agency-1-agency_legal_document-x.jpg',
      });
      prisma.agencyLegalDocument.create.mockResolvedValue({});

      const file = {
        buffer: Buffer.from('contenu'),
        originalName: 'registre-commerce.pdf',
        mimeType: 'application/pdf',
      };

      await service.addLegalDocument(
        'owner-1',
        {
          label: 'Registre de commerce',
          expiresAt: '2026-12-31T00:00:00.000Z',
        },
        file,
      );

      expect(storageProvider.store).toHaveBeenCalledWith(
        'agency-1',
        'agency_legal_document',
        file,
      );
      expect(prisma.agencyLegalDocument.create).toHaveBeenCalledWith({
        data: {
          agencyId: 'agency-1',
          label: 'Registre de commerce',
          storageRef: 'local://documents/agency-1-agency_legal_document-x.jpg',
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
      });
    });

    it("n'invente pas de date d'expiration quand aucune n'est fournie", async () => {
      prisma.agency.findUnique.mockResolvedValue(baseAgency);
      storageProvider.store.mockResolvedValue({
        storageRef: 'local://documents/agency-1-agency_legal_document-y.jpg',
      });
      prisma.agencyLegalDocument.create.mockResolvedValue({});

      await service.addLegalDocument(
        'owner-1',
        { label: 'Statuts de société' },
        {
          buffer: Buffer.from('contenu'),
          originalName: 'statuts.pdf',
          mimeType: 'application/pdf',
        },
      );

      expect(prisma.agencyLegalDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresAt: null }),
        }),
      );
    });
  });

  describe('getComplianceAlerts', () => {
    const now = new Date('2026-06-15T00:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('signale un document déjà expiré et un document expirant sous 30 jours, ignore le reste', async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        legalDocuments: [
          {
            id: 'doc-expired',
            label: 'Agrément',
            storageRef: 'ref-1',
            uploadedAt: now,
            expiresAt: new Date('2026-06-01T00:00:00.000Z'), // passé
          },
          {
            id: 'doc-expiring-soon',
            label: 'Assurance',
            storageRef: 'ref-2',
            uploadedAt: now,
            expiresAt: new Date('2026-06-20T00:00:00.000Z'), // dans 5 jours
          },
          {
            id: 'doc-far',
            label: 'Registre de commerce',
            storageRef: 'ref-3',
            uploadedAt: now,
            expiresAt: new Date('2027-01-01T00:00:00.000Z'), // loin
          },
          {
            id: 'doc-no-expiry',
            label: 'Statuts',
            storageRef: 'ref-4',
            uploadedAt: now,
            expiresAt: null, // jamais présumé expiré
          },
        ],
      });

      const alerts = await service.getComplianceAlerts('owner-1');

      expect(alerts).toEqual([
        {
          id: 'doc-expired',
          label: 'Agrément',
          expiresAt: new Date('2026-06-01T00:00:00.000Z'),
          status: 'expired',
        },
        {
          id: 'doc-expiring-soon',
          label: 'Assurance',
          expiresAt: new Date('2026-06-20T00:00:00.000Z'),
          status: 'expiring_soon',
        },
      ]);
    });
  });

  describe('getLegalDocumentAccessUrl', () => {
    it("renvoie l'URL signée pour un document appartenant à l'agence", async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        legalDocuments: [
          {
            id: 'doc-1',
            label: 'Agrément',
            storageRef: 'ref-1',
            uploadedAt: new Date('2026-01-01'),
            expiresAt: null,
          },
        ],
      });
      storageProvider.getAccessUrl.mockResolvedValue({
        url: '/api/v1/documents/files/token',
        expiresAt: new Date('2026-01-01T00:05:00.000Z'),
      });

      const result = await service.getLegalDocumentAccessUrl(
        'owner-1',
        'doc-1',
      );

      expect(storageProvider.getAccessUrl).toHaveBeenCalledWith('ref-1');
      expect(result.url).toBe('/api/v1/documents/files/token');
    });

    it("refuse un document qui n'appartient pas à l'agence demandeuse", async () => {
      prisma.agency.findUnique.mockResolvedValue(baseAgency); // legalDocuments: []

      await expect(
        service.getLegalDocumentAccessUrl('owner-1', 'doc-inconnu'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageProvider.getAccessUrl).not.toHaveBeenCalled();
    });
  });

  // Idée #70 (backlog "Cent Fonctionnalités") — calendrier des échéances.
  describe('getOrCreateCalendarSubscription', () => {
    it('renvoie le jeton existant sans le régénérer', async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        calendarToken: 'jeton-existant',
      });

      const result = await service.getOrCreateCalendarSubscription('owner-1');

      expect(result.token).toBe('jeton-existant');
      expect(result.subscriptionUrl).toBe(
        '/api/v1/calendar/agency/jeton-existant/calendar.ics',
      );
      expect(prisma.agency.update).not.toHaveBeenCalled();
    });

    it("génère un jeton si l'agence n'en a pas encore", async () => {
      prisma.agency.findUnique.mockResolvedValueOnce({
        ...baseAgency,
        calendarToken: null,
      });
      // Second appel : celui de regenerateCalendarSubscription -> findByOwnerOrFail.
      prisma.agency.findUnique.mockResolvedValueOnce(baseAgency);
      prisma.agency.update.mockResolvedValue(baseAgency);

      const result = await service.getOrCreateCalendarSubscription('owner-1');

      expect(result.token).toEqual(expect.any(String));
      expect(result.token.length).toBeGreaterThan(0);
      expect(prisma.agency.update).toHaveBeenCalledWith({
        where: { id: 'agency-1' },
        data: { calendarToken: result.token },
      });
    });

    it("lève NotFoundException si l'agence n'existe pas", async () => {
      prisma.agency.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateCalendarSubscription('owner-inconnu'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('regenerateCalendarSubscription', () => {
    it('remplace le jeton par un nouveau (révocation de l’ancienne URL)', async () => {
      prisma.agency.findUnique.mockResolvedValue({
        ...baseAgency,
        calendarToken: 'ancien-jeton',
      });
      prisma.agency.update.mockResolvedValue(baseAgency);

      const result = await service.regenerateCalendarSubscription('owner-1');

      expect(result.token).not.toBe('ancien-jeton');
      expect(prisma.agency.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agency-1' },
          data: { calendarToken: result.token },
        }),
      );
    });
  });

  describe('findByCalendarTokenOrFail', () => {
    it("renvoie l'agence correspondant au jeton", async () => {
      prisma.agency.findUnique.mockResolvedValue(baseAgency);

      const result = await service.findByCalendarTokenOrFail('un-jeton');

      expect(prisma.agency.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { calendarToken: 'un-jeton' } }),
      );
      expect(result.id).toBe('agency-1');
    });

    it('rejette un jeton invalide ou révoqué', async () => {
      prisma.agency.findUnique.mockResolvedValue(null);

      await expect(
        service.findByCalendarTokenOrFail('jeton-invalide'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
