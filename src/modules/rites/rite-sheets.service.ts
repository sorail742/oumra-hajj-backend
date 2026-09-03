import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRiteSheetDto } from './dto/create-rite-sheet.dto';
import { UpdateRiteSheetDto } from './dto/update-rite-sheet.dto';
import { RiteSheet, RiteSheetDocument } from './schemas/rite-sheet.schema';

@Injectable()
export class RiteSheetsService {
  constructor(
    @InjectModel(RiteSheet.name)
    private readonly riteSheetModel: Model<RiteSheetDocument>,
  ) {}

  // Une fiche nouvellement créée n'est jamais publiée directement — elle
  // doit être validée explicitement par une personne qualifiée (voir
  // CLAUDE.md, section "Contenu religieux").
  create(dto: CreateRiteSheetDto): Promise<RiteSheetDocument> {
    return this.riteSheetModel.create({ ...dto, isValidated: false });
  }

  async update(
    id: string,
    dto: UpdateRiteSheetDto,
  ): Promise<RiteSheetDocument> {
    const sheet = await this.findByIdOrFail(id);
    Object.assign(sheet, dto);
    // Toute modification de contenu invalide la validation précédente.
    sheet.isValidated = false;
    sheet.validatedBy = undefined;
    sheet.validatedAt = undefined;
    sheet.version += 1;
    return sheet.save();
  }

  async validate(id: string, reviewerId: string): Promise<RiteSheetDocument> {
    const sheet = await this.findByIdOrFail(id);
    sheet.isValidated = true;
    sheet.validatedBy = reviewerId;
    sheet.validatedAt = new Date();
    return sheet.save();
  }

  findByIdOrFail(id: string): Promise<RiteSheetDocument> {
    return this.riteSheetModel
      .findById(id)
      .exec()
      .then((sheet) => {
        if (!sheet) {
          throw new NotFoundException('Fiche de rite introuvable');
        }
        return sheet;
      });
  }

  // Catalogue public : uniquement le contenu validé par une personne
  // qualifiée.
  listPublished(
    pilgrimageType?: string,
    language?: string,
  ): Promise<RiteSheetDocument[]> {
    const filter: Record<string, unknown> = { isValidated: true };
    if (pilgrimageType) {
      filter.pilgrimageType = { $in: [pilgrimageType, 'both'] };
    }
    if (language) {
      filter.language = language;
    }
    return this.riteSheetModel.find(filter).sort({ order: 1 }).exec();
  }

  // File de modération admin : tout le contenu, validé ou non.
  listAll(): Promise<RiteSheetDocument[]> {
    return this.riteSheetModel.find().sort({ order: 1 }).exec();
  }
}
