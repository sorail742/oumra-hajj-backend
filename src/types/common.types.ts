import { ApiProperty } from '@nestjs/swagger';

// Types partagés entre modules — formes de réponse HTTP indépendantes de
// l'ORM (Mongoose aujourd'hui, Prisma après migration — voir ADR 0013).
// Ne pas réexporter directement un type Mongoose/Prisma ici : ce dossier
// documente le contrat public de l'API, pas les détails de stockage.

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
}

// Accusé d'une demande traitée sans autre donnée (`{ sent: true }`).
// Type littéral non déductible par le plugin Swagger : décrit à la main.
export class SentShape {
  @ApiProperty({ type: Boolean, example: true })
  sent!: true;
}

// Accusé d'une suppression (`{ success: true }`).
export class SuccessShape {
  @ApiProperty({ type: Boolean, example: true })
  success!: true;
}

export class HealthShape {
  status!: string;
  timestamp!: string;
}
