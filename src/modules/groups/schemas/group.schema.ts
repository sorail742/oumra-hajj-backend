import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema({ _id: false })
export class ItineraryStep {
  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  date!: Date;

  @Prop()
  location?: string;
}

@Schema({ _id: false })
export class MemberLocation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;

  @Prop({ required: true })
  updatedAt!: Date;
}

@Schema({ timestamps: true })
export class Group {
  @Prop({ type: Types.ObjectId, ref: 'Package', required: true, index: true })
  package!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agency', required: true, index: true })
  agency!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  guide?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  members!: Types.ObjectId[];

  @Prop({ type: [ItineraryStep], default: [] })
  itinerary!: ItineraryStep[];

  // Partage de position opt-in — cahier des charges §3.1 "Localisation & sécurité famille".
  @Prop({ type: [MemberLocation], default: [] })
  locations!: MemberLocation[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
