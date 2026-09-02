import { RiteSheetPilgrimageType } from '../modules/rites/schemas/rite-sheet.schema';

export interface RiteSheetShape {
  id: string;
  key: string;
  title: string;
  pilgrimageType: RiteSheetPilgrimageType;
  order: number;
  content: string;
  audioRef?: string;
  language: string;
  version: number;
  isValidated: boolean;
  validatedById?: string;
  validatedAt?: Date;
}

export interface RiteProgressShape {
  id: string;
  pilgrimId: string;
  riteKey: string;
  completed: boolean;
  tawafCount: number;
  saiCount: number;
  clientUpdatedAt: Date;
}
