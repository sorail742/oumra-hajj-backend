import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RiteProgressDocument = RiteProgress & Document;

// Progression pèlerin sur une fiche du guide des rites, + compteur Tawaf/Sa'i
// courant pour cette étape. Synchronisée par lot depuis l'app mobile
// (stratégie "local-first, sync-later" — voir ADR 0007).
@Schema({ timestamps: true })
export class RiteProgress {
  // Id Postgres (UUID) depuis la migration Prisma de users/auth (ADR 0013).
  @Prop({ required: true, index: true })
  pilgrim!: string;

  @Prop({ required: true, index: true })
  riteKey!: string;

  @Prop({ default: false })
  completed!: boolean;

  @Prop({ default: 0 })
  tawafCount!: number;

  @Prop({ default: 0 })
  saiCount!: number;

  // Horodatage côté client, utilisé pour résoudre les conflits lors de la
  // synchronisation par lot (voir ADR 0007).
  @Prop({ required: true, default: () => new Date() })
  clientUpdatedAt!: Date;
}

export const RiteProgressSchema = SchemaFactory.createForClass(RiteProgress);
RiteProgressSchema.index({ pilgrim: 1, riteKey: 1 }, { unique: true });
