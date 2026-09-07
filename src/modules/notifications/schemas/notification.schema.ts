import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  BOOKING_STATUS = 'booking_status',
  PAYMENT = 'payment',
  DOCUMENT = 'document',
  RITE_REMINDER = 'rite_reminder',
  SOS = 'sos',
  GROUP_MESSAGE = 'group_message',
  MODERATION = 'moderation',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class Notification {
  // Id Postgres (UUID) depuis la migration Prisma de users/auth (ADR 0013).
  @Prop({ required: true, index: true })
  recipient!: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type!: NotificationType;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  // Alertes critiques (SOS, dossier bloqué) — bascule en SMS de secours si le
  // push n'est pas confirmé délivré (voir ADR 0009).
  @Prop({ default: false })
  isCritical!: boolean;

  @Prop()
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
