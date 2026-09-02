import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument, Types } from 'mongoose';

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
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  booking!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  pilgrim!: Types.ObjectId;

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
