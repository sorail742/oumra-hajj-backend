import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RiteSheetDocument = RiteSheet & Document;

export enum RiteSheetPilgrimageType {
  OUMRA = 'oumra',
  HADJ = 'hadj',
  BOTH = 'both',
}

// Fiche de rite (Ihram, Tawaf, Sa'i, Rami, stations du Hadj...). Toute fiche
// créée ou modifiée doit être revalidée par une personne qualifiée avant
// publication — voir CLAUDE.md (section "Contenu religieux") et cahier des
// charges §3.4 "Modération de contenu". `isValidated` reste à `false` tant
// que cette relecture n'a pas eu lieu explicitement.
@Schema({ timestamps: true })
export class RiteSheet {
  @Prop({ required: true, index: true })
  key!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, enum: RiteSheetPilgrimageType, required: true })
  pilgrimageType!: RiteSheetPilgrimageType;

  @Prop({ required: true, default: 0 })
  order!: number;

  @Prop({ required: true })
  content!: string;

  // Référence média externe (audio) — pas de fichier stocké en base.
  @Prop()
  audioRef?: string;

  @Prop({ default: 'fr' })
  language!: string;

  // Incrémenté à chaque modification de contenu — permet à l'app mobile de
  // détecter une mise à jour du cache hors-ligne sans perdre la progression
  // du pèlerin (voir ADR 0007).
  @Prop({ default: 1 })
  version!: number;

  @Prop({ default: false })
  isValidated!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  validatedBy?: Types.ObjectId;

  @Prop()
  validatedAt?: Date;
}

export const RiteSheetSchema = SchemaFactory.createForClass(RiteSheet);
