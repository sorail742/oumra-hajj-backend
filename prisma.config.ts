// Configuration Prisma 7 pour le CLI (migrate, studio, ...) — voir
// docs/adr/0013-migration-postgresql-prisma.md. L'URL de connexion runtime
// (PrismaService) est configurée séparément via un driver adapter.
//
// `env()` (l'aide stricte de Prisma) lève une erreur si DATABASE_URL est
// absente, ce qui casserait `npm install` (postinstall: prisma generate)
// juste après un clone, avant même la création du .env local — on retombe
// donc sur process.env directement, avec un placeholder par défaut. `prisma
// generate` n'a pas besoin d'une URL valide ; seules les commandes migrate/
// studio en ont besoin, et échoueront alors normalement si DATABASE_URL
// n'est pas configurée dans .env.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/placeholder',
  },
});
