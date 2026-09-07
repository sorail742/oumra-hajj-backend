import { RiteSheetPilgrimageType } from '../common/enums/rite-sheet-pilgrimage-type.enum';

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
