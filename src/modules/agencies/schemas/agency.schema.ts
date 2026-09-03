import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type AgencyDocument = Agency & MongooseDocument;

export enum AgencyValidationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ _id: false })
export class LegalDocumentRef {
  @Prop({ required: true })
  label!: string;

  // Référence vers le stockage objet externe — jamais le fichier lui-même
  // (voir ADR 0008).
  @Prop({ required: true })
  storageRef!: string;

  @Prop({ default: () => new Date() })
  uploadedAt!: Date;
}

@Schema({ timestamps: true })
export class Agency {
  @Prop({ required: true })
  legalName!: string;

  // Utilisateur (role=agency) propriétaire du compte agence — id Postgres
  // (UUID) depuis la migration Prisma du module users/auth (ADR 0013),
  // stocké en string simple : plus de ref/populate Mongoose inter-base.
  @Prop({ required: true, unique: true })
  owner!: string;

  @Prop({ required: true })
  contactEmail!: string;

  @Prop({ required: true })
  contactPhone!: string;

  @Prop()
  address?: string;

  @Prop({ type: [LegalDocumentRef], default: [] })
  legalDocuments!: LegalDocumentRef[];

  @Prop({
    type: String,
    enum: AgencyValidationStatus,
    default: AgencyValidationStatus.PENDING,
    index: true,
  })
  validationStatus!: AgencyValidationStatus;

  @Prop()
  rejectionReason?: string;

  @Prop()
  validatedBy?: string;

  @Prop()
  validatedAt?: Date;

  // Commission plateforme (%) — voir cahier des charges §9 Modèle économique.
  @Prop({ default: 0 })
  commissionRate!: number;

  @Prop({ type: Object })
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  };
}

export const AgencySchema = SchemaFactory.createForClass(Agency);
