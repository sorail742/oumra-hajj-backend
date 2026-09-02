import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../../common/enums/role.enum';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop()
  relationship?: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  fullName!: string;

  // Identifiant principal pèlerin/guide — voir ADR 0003.
  @Prop({ unique: true, sparse: true, index: true })
  phone?: string;

  // Identifiant principal agence/admin — voir ADR 0003.
  @Prop({
    unique: true,
    sparse: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  email?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ type: String, enum: Role, required: true, index: true })
  role!: Role;

  @Prop({ default: 'fr' })
  preferredLanguage!: string;

  @Prop({ type: EmergencyContact })
  emergencyContact?: EmergencyContact;

  @Prop()
  bloodType?: string;

  @Prop()
  passportNumber?: string;

  // Agence de rattachement pour un utilisateur guide.
  @Prop({ type: Types.ObjectId, ref: 'Agency', index: true })
  agency?: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
