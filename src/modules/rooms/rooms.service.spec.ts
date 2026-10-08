import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { RoomsService } from './rooms.service';

// Données explicitement factices (idée #40).
const BLOC_ID = '11111111-1111-4111-8111-111111111111';
const RESA = (n: number) => `resa-${n}`;

function bloc(surcharge: Record<string, unknown> = {}) {
  return {
    id: BLOC_ID,
    agencyId: 'agence-1',
    packageId: 'forfait-1',
    stageId: null,
    hotelName: '[DÉMO] Hôtel fictif',
    city: 'La Mecque',
    roomType: 'double',
    roomCount: 2,
    releaseDate: null,
    notes: null,
    package: { title: '[DÉMO] Oumra fictive' },
    assignments: [] as unknown[],
    ...surcharge,
  };
}

function place(n: number, chambre: number) {
  return {
    roomNumber: chambre,
    booking: { id: RESA(n), pilgrim: { fullName: `[DÉMO] Pèlerin ${n}` } },
  };
}

describe('RoomsService', () => {
  let prisma: {
    roomBlock: Record<string, jest.Mock>;
    roomAssignment: Record<string, jest.Mock>;
    booking: Record<string, jest.Mock>;
    package: Record<string, jest.Mock>;
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let service: RoomsService;

  beforeEach(() => {
    prisma = {
      roomBlock: {
        findUnique: jest.fn().mockResolvedValue(bloc()),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: BLOC_ID }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      roomAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: RESA(9),
          agencyId: 'agence-1',
          packageId: 'forfait-1',
          status: 'confirmed',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      package: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    service = new RoomsService(
      prisma as unknown as PrismaService,
      {
        findByOwnerOrFail: jest.fn().mockResolvedValue({ id: 'agence-1' }),
      } as unknown as AgenciesService,
    );
  });

  it('calcule capacité, occupation et réservations encore à placer', async () => {
    prisma.roomBlock.findUnique.mockResolvedValue(
      bloc({ assignments: [place(1, 1), place(2, 1), place(3, 2)] }),
    );
    prisma.booking.findMany.mockResolvedValue(
      [1, 2, 3, 4].map((n) => ({
        id: RESA(n),
        packageId: 'forfait-1',
        pilgrim: { fullName: `[DÉMO] Pèlerin ${n}` },
      })),
    );

    const resultat = await service.getBlock('proprietaire-1', BLOC_ID);

    expect(resultat.bedsPerRoom).toBe(2);
    expect(resultat.totalBeds).toBe(4);
    expect(resultat.assignedBeds).toBe(3);
    expect(resultat.rooms.map((r) => r.occupants.length)).toEqual([2, 1]);
    expect(resultat.unassigned).toEqual([
      { bookingId: RESA(4), pilgrimName: '[DÉMO] Pèlerin 4' },
    ]);
  });

  it("refuse le bloc d'une autre agence", async () => {
    prisma.roomBlock.findUnique.mockResolvedValue(
      bloc({ agencyId: 'agence-2' }),
    );
    await expect(
      service.getBlock('proprietaire-1', BLOC_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("reprend l'hôtel et la ville de l'étape choisie", async () => {
    prisma.package.findUnique.mockResolvedValue({
      id: 'forfait-1',
      agencyId: 'agence-1',
      stages: [
        { id: 'etape-1', hotelName: '[DÉMO] Hôtel étape', city: 'Médine' },
      ],
    });

    await service.createBlock('proprietaire-1', {
      packageId: 'forfait-1',
      stageId: 'etape-1',
      roomType: 'quadruple',
      roomCount: 10,
    });

    expect(prisma.roomBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hotelName: '[DÉMO] Hôtel étape',
        city: 'Médine',
        stageId: 'etape-1',
        roomType: 'quadruple',
      }),
    });
  });

  it('place dans la première chambre qui a de la place, sous verrou du bloc', async () => {
    prisma.roomAssignment.findMany.mockResolvedValue([
      { roomNumber: 1 },
      { roomNumber: 1 },
    ]);

    await service.assign('proprietaire-1', BLOC_ID, { bookingId: RESA(9) });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.roomAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ roomNumber: 2 }),
        update: { roomNumber: 2 },
      }),
    );
  });

  it('refuse une chambre complète, un bloc complet ou une chambre hors bloc', async () => {
    prisma.roomAssignment.findMany.mockResolvedValue([
      { roomNumber: 1 },
      { roomNumber: 1 },
    ]);
    await expect(
      service.assign('p', BLOC_ID, { bookingId: RESA(9), roomNumber: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.assign('p', BLOC_ID, { bookingId: RESA(9), roomNumber: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.roomAssignment.findMany.mockResolvedValue(
      [1, 1, 2, 2].map((roomNumber) => ({ roomNumber })),
    );
    await expect(
      service.assign('p', BLOC_ID, { bookingId: RESA(9) }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.roomAssignment.upsert).not.toHaveBeenCalled();
  });

  it("refuse une réservation d'un autre forfait ou annulée", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: RESA(9),
      agencyId: 'agence-1',
      packageId: 'forfait-2',
      status: 'confirmed',
    });
    await expect(
      service.assign('p', BLOC_ID, { bookingId: RESA(9) }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.booking.findUnique.mockResolvedValue({
      id: RESA(9),
      agencyId: 'agence-1',
      packageId: 'forfait-1',
      status: 'cancelled',
    });
    await expect(
      service.assign('p', BLOC_ID, { bookingId: RESA(9) }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ne réduit pas le bloc sous une chambre occupée, ne supprime pas un bloc occupé', async () => {
    prisma.roomBlock.findUnique.mockResolvedValue(
      bloc({ roomCount: 5, assignments: [place(1, 4)] }),
    );
    await expect(
      service.updateBlock('p', BLOC_ID, { roomCount: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.deleteBlock('p', BLOC_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.roomBlock.update).not.toHaveBeenCalled();
    expect(prisma.roomBlock.delete).not.toHaveBeenCalled();
  });

  it("produit la rooming list de l'hôtel, formules neutralisées", async () => {
    prisma.roomBlock.findUnique.mockResolvedValue(
      bloc({
        assignments: [
          place(1, 1),
          {
            roomNumber: 2,
            booking: { id: RESA(2), pilgrim: { fullName: '=1+1' } },
          },
        ],
      }),
    );

    const csv = await service.getRoomingListCsv('p', BLOC_ID);

    expect(csv.split('\r\n')).toEqual([
      '﻿"Hôtel";"Ville";"Type";"Chambre";"Pèlerin"',
      '"[DÉMO] Hôtel fictif";"La Mecque";"Double";"1";"[DÉMO] Pèlerin 1"',
      `"[DÉMO] Hôtel fictif";"La Mecque";"Double";"2";"'=1+1"`,
    ]);
  });
});
