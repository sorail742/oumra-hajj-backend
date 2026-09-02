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
