// Configuration Prisma 7 pour le CLI (migrate, studio, ...) — repris tel
// quel d'Oumra-hadj-project (voir son ADR 0013). L'URL de connexion
// runtime (PrismaService) est configurée séparément via un driver adapter,
// voir prisma.service.ts.
//
// **Vérifier la version de Prisma réellement installée** au moment de
// démarrer DarMeuble — ce fichier suppose Prisma 7 (plus d'URL lue
// implicitement depuis schema.prisma). Une version différente peut exiger
// une configuration différente ; se référer à la documentation Prisma en
// vigueur à ce moment-là plutôt qu'à ce commentaire.
//
// `env()` (l'aide stricte de Prisma) lève une erreur si DATABASE_URL est
// absente, ce qui casserait `npm install` (postinstall: prisma generate)
// juste après un clone, avant même la création du `.env` local — on
// retombe donc sur `process.env` directement, avec un placeholder par
// défaut. `prisma generate` n'a pas besoin d'une URL valide ; seules les
// commandes migrate/studio en ont besoin, et échoueront normalement si
// `DATABASE_URL` n'est pas configurée.
import 'dotenv/config';
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
