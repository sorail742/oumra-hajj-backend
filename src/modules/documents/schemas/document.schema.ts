import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type PilgrimDocumentDocument = PilgrimDocument & MongooseDocument;

export enum PilgrimDocumentType {
  PASSPORT = 'passport',
  VISA = 'visa',
  FLIGHT_TICKET = 'flight_ticket',
  VACCINATION_CERTIFICATE = 'vaccination_certificate',
}

export enum PilgrimDocumentStatus {
  PENDING = 'pending',
  VALIDATED = 'validated',
  REJECTED = 'rejected',
}

// Coffre-fort documents — le fichier lui-même vit dans un stockage objet
// externe chiffré, jamais dans MongoDB (voir ADR 0008). `storageRef` est la
// seule référence conservée ici.
@Schema({ timestamps: true })
export class PilgrimDocument {
  // Id Postgres (UUID) depuis la migration Prisma du module bookings (ADR 0013).
  @Prop({ required: true, index: true })
  booking!: string;

  // Id Postgres (UUID) depuis la migration Prisma de users/auth (ADR 0013).
  @Prop({ required: true, index: true })
  pilgrim!: string;

  @Prop({ type: String, enum: PilgrimDocumentType, required: true })
  type!: PilgrimDocumentType;

  @Prop({ required: true })
  storageRef!: string;

  @Prop({
    type: String,
    enum: PilgrimDocumentStatus,
    default: PilgrimDocumentStatus.PENDING,
  })
  status!: PilgrimDocumentStatus;

  @Prop()
  rejectionReason?: string;
}

export const PilgrimDocumentSchema =
  SchemaFactory.createForClass(PilgrimDocument);
