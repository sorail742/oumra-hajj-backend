import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, index: true })
  phone!: string;

  @Prop({ required: true })
  codeHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: 0 })
  attempts!: number;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
// TTL index Mongo : purge automatique des OTP expirés.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
