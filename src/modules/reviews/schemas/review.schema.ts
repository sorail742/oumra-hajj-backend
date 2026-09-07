import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  // Id Postgres (UUID) depuis la migration Prisma de users/auth (ADR 0013).
  @Prop({ required: true, index: true })
  pilgrim!: string;

  // Id Postgres (UUID) depuis la migration Prisma du module agencies (ADR 0013).
  @Prop({ required: true, index: true })
  agency!: string;

  // Id Postgres (UUID) depuis la migration Prisma du module bookings (ADR 0013).
  @Prop({ required: true, unique: true })
  booking!: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop()
  comment?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
