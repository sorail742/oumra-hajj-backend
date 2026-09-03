import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
  // Id Postgres (UUID) depuis la migration Prisma de users/auth (ADR 0013).
  @Prop({ required: true })
  user!: string;

  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;

  @Prop({ required: true })
  updatedAt!: Date;
}

@Schema({ timestamps: true })
export class Group {
  // Id Postgres (UUID) depuis la migration Prisma du module packages (ADR 0013).
  @Prop({ required: true, index: true })
  package!: string;

  // Id Postgres (UUID) depuis la migration Prisma du module agencies (ADR 0013).
  @Prop({ required: true, index: true })
  agency!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  guide?: string;

  @Prop({ type: [String], default: [] })
  members!: string[];

  @Prop({ type: [ItineraryStep], default: [] })
  itinerary!: ItineraryStep[];

  // Partage de position opt-in — cahier des charges §3.1 "Localisation & sécurité famille".
  @Prop({ type: [MemberLocation], default: [] })
  locations!: MemberLocation[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
