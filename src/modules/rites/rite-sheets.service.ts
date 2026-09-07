import { Injectable, NotFoundException } from '@nestjs/common';
import {
  RiteSheet as PrismaRiteSheet,
  RiteSheetPilgrimageType as PrismaRiteSheetPilgrimageType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RiteSheetPilgrimageType } from '../../common/enums/rite-sheet-pilgrimage-type.enum';
import { RiteSheetShape } from '../../types/rite.types';
import { CreateRiteSheetDto } from './dto/create-rite-sheet.dto';
import { UpdateRiteSheetDto } from './dto/update-rite-sheet.dto';

function toRiteSheetShape(sheet: PrismaRiteSheet): RiteSheetShape {
  return {
    id: sheet.id,
    key: sheet.key,
    title: sheet.title,
    pilgrimageType: sheet.pilgrimageType as unknown as RiteSheetPilgrimageType,
    order: sheet.order,
    content: sheet.content,
    audioRef: sheet.audioRef ?? undefined,
    language: sheet.language,
    version: sheet.version,
    isValidated: sheet.isValidated,
    validatedById: sheet.validatedById ?? undefined,
    validatedAt: sheet.validatedAt ?? undefined,
  };
}

@Injectable()
export class RiteSheetsService {
  constructor(private readonly prisma: PrismaService) {}

  // Une fiche nouvellement créée n'est jamais publiée directement — elle
  // doit être validée explicitement par une personne qualifiée (voir
  // CLAUDE.md, section "Contenu religieux").
  async create(dto: CreateRiteSheetDto): Promise<RiteSheetShape> {
    const sheet = await this.prisma.riteSheet.create({
      data: {
        ...dto,
        pilgrimageType:
          dto.pilgrimageType as unknown as PrismaRiteSheetPilgrimageType,
        isValidated: false,
      },
    });
    return toRiteSheetShape(sheet);
  }

  async update(id: string, dto: UpdateRiteSheetDto): Promise<RiteSheetShape> {
    const { pilgrimageType, ...rest } = dto;
    const sheet = await this.prisma.riteSheet
      .update({
        where: { id },
        data: {
          ...rest,
          ...(pilgrimageType && {
            pilgrimageType:
              pilgrimageType as unknown as PrismaRiteSheetPilgrimageType,
          }),
          // Toute modification de contenu invalide la validation précédente.
          isValidated: false,
          validatedById: null,
          validatedAt: null,
          version: { increment: 1 },
        },
      })
      .catch(() => {
        throw new NotFoundException('Fiche de rite introuvable');
      });
    return toRiteSheetShape(sheet);
  }

  async validate(id: string, reviewerId: string): Promise<RiteSheetShape> {
    const sheet = await this.prisma.riteSheet
      .update({
        where: { id },
        data: {
          isValidated: true,
          validatedById: reviewerId,
          validatedAt: new Date(),
        },
      })
      .catch(() => {
        throw new NotFoundException('Fiche de rite introuvable');
      });
    return toRiteSheetShape(sheet);
  }

  async findByIdOrFail(id: string): Promise<RiteSheetShape> {
    const sheet = await this.prisma.riteSheet.findUnique({ where: { id } });
    if (!sheet) {
      throw new NotFoundException('Fiche de rite introuvable');
    }
    return toRiteSheetShape(sheet);
  }

  // Catalogue public : uniquement le contenu validé par une personne
  // qualifiée.
  async listPublished(
    pilgrimageType?: string,
    language?: string,
  ): Promise<RiteSheetShape[]> {
    const sheets = await this.prisma.riteSheet.findMany({
      where: {
        isValidated: true,
        ...(pilgrimageType && {
          pilgrimageType: {
            in: [pilgrimageType, 'both'] as PrismaRiteSheetPilgrimageType[],
          },
        }),
        ...(language && { language }),
      },
      orderBy: { order: 'asc' },
    });
    return sheets.map(toRiteSheetShape);
  }

  // File de modération admin : tout le contenu, validé ou non.
  async listAll(): Promise<RiteSheetShape[]> {
    const sheets = await this.prisma.riteSheet.findMany({
      orderBy: { order: 'asc' },
    });
    return sheets.map(toRiteSheetShape);
  }
}
