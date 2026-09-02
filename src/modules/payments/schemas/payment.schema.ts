import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentMethod {
  MOBILE_MONEY_ORANGE = 'mobile_money_orange',
  MOBILE_MONEY_MTN = 'mobile_money_mtn',
  CARD = 'card',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

// Aucune donnée de carte bancaire n'est stockée ici — seule la référence de
// transaction du prestataire est conservée (voir ADR 0006).
@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  booking!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ default: 'GNF' })
  currency!: string;

  @Prop({ required: true, min: 1 })
  installmentNumber!: number;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  method!: PaymentMethod;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    index: true,
  })
  status!: PaymentStatus;

  @Prop({ required: true, unique: true, index: true })
  providerReference!: string;

  @Prop()
  receiptRef?: string;

  @Prop()
  confirmedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
