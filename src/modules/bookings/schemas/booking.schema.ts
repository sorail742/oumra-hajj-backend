import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookingDocument = Booking & Document;

export enum BookingStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum DossierStepKey {
  PAYMENT = 'payment',
  VISA = 'visa',
  FLIGHT = 'flight',
  VACCINATION = 'vaccination',
  DOCUMENTS = 'documents',
}

export enum DossierStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

@Schema({ _id: false })
export class DossierStep {
  @Prop({ type: String, enum: DossierStepKey, required: true })
  key!: DossierStepKey;

  @Prop({
    type: String,
    enum: DossierStepStatus,
    default: DossierStepStatus.PENDING,
  })
  status!: DossierStepStatus;

  @Prop({ default: () => new Date() })
  updatedAt!: Date;
}

const DEFAULT_STEPS: DossierStepKey[] = [
  DossierStepKey.PAYMENT,
  DossierStepKey.VISA,
  DossierStepKey.FLIGHT,
  DossierStepKey.VACCINATION,
  DossierStepKey.DOCUMENTS,
];

@Schema({ timestamps: true })
export class Booking {
  // Id Postgres (UUID) depuis la migration Prisma de users/auth (ADR 0013).
  @Prop({ required: true, index: true })
  pilgrim!: string;

  // Id Postgres (UUID) depuis la migration Prisma du module packages (ADR 0013).
  @Prop({ required: true, index: true })
  package!: string;

  // Id Postgres (UUID) depuis la migration Prisma du module agencies (ADR 0013).
  @Prop({ required: true, index: true })
  agency!: string;

  // Id Postgres (UUID) depuis la migration Prisma du module groups (ADR 0013).
  @Prop()
  group?: string;

  @Prop({
    type: String,
    enum: BookingStatus,
    default: BookingStatus.PENDING_PAYMENT,
    index: true,
  })
  status!: BookingStatus;

  @Prop({
    type: [DossierStep],
    default: () =>
      DEFAULT_STEPS.map((key) => ({ key, status: DossierStepStatus.PENDING })),
  })
  steps!: DossierStep[];
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
