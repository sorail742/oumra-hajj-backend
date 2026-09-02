import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PackageDocument = Package & Document;

export enum PilgrimageType {
  OUMRA = 'oumra',
  HADJ = 'hadj',
}

export enum PackageStatus {
  OPEN = 'open',
  FULL = 'full',
  CLOSED = 'closed',
}

@Schema({ _id: false })
export class HotelInfo {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  city!: string;

  @Prop()
  distanceToMosqueMeters?: number;
}

@Schema({ timestamps: true })
export class Package {
  @Prop({ type: Types.ObjectId, ref: 'Agency', required: true, index: true })
  agency!: Types.ObjectId;

  @Prop({ type: String, enum: PilgrimageType, required: true, index: true })
  type!: PilgrimageType;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ required: true })
  price!: number;

  @Prop({ default: 'GNF' })
  currency!: string;

  @Prop({ required: true, min: 1 })
  capacity!: number;

  @Prop({ default: 0 })
  seatsTaken!: number;

  @Prop({ type: HotelInfo })
  hotel?: HotelInfo;

  @Prop({ type: [String], default: [] })
  inclusions!: string[];

  @Prop({
    type: String,
    enum: PackageStatus,
    default: PackageStatus.OPEN,
    index: true,
  })
  status!: PackageStatus;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
