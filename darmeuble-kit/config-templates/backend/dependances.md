# Dépendances de départ — DarMeuble backend

**Ne pas copier de numéros de version depuis les projets sources** — celles
de smartsms-backend et Oumra-hadj-project datent de leur propre moment
d'installation. Vérifier chaque version sur le registre npm au moment de
créer DarMeuble, puis l'épingler sans `^`.

## Scripts (`package.json`)

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

## Dépendances de production

`@nestjs/{core,common,platform-express,config,jwt,passport,throttler,swagger}`,
`@prisma/client`, `@prisma/adapter-pg` (driver adapter — voir
`prisma.config.ts`/`prisma.service.ts` dans `code-templates/`),
`class-validator`, `class-transformer`, `passport`, `passport-jwt`,
`bcrypt`, `helmet`, `nestjs-pino` + `pino-http` (logger structuré, voir
`docs/backend/socle-backend.md` §0), `cookie-parser` (lecture du cookie de
refresh sur `/api/auth/refresh`, voir ADR-0004).

**Non tranchés — à ajouter une fois la décision prise** (voir
`docs/backend/socle-backend.md` §0bis) :

- Un client HTTP pour Djomy — dépend de son contrat réel (REST simple ?
  SDK officiel ?).
- Une bibliothèque de génération PDF pour les contrats/quittances (§5.3,
  §5.5) — `pdf-lib` (génération programmatique) ou `puppeteer`/`playwright`
  (rendu HTML→PDF, plus lourd mais plus proche d'un gabarit visuel) selon
  la complexité réelle des modèles de contrat, non fournis au moment de la
  rédaction de ce kit.
- Un SDK/provider SMS — fournisseur non choisi.
- Un client de stockage objet (S3-compatible) si le stockage disque local
  ne suffit plus — voir le `StorageProvider` d'Oumra-hadj-project comme
  gabarit d'abstraction, même principe que `PaymentProvider`.

## Dépendances de développement

`typescript`, `@types/*` correspondants, `jest`, `ts-jest` ou `@swc/jest`,
`supertest`, `eslint` + `typescript-eslint` + `eslint-plugin-prettier`,
`prettier`, `husky`, `lint-staged`, `prisma` (CLI).

## Gestionnaire de paquets

Un seul, `npm` ou `pnpm` — pas les deux. Fixer la version de Node exacte
dans `.nvmrc` + `engines`/`engine-strict` (voir
`docs/backend/coding-rules-backend.md` §"Environnement local", leçon tirée
de smartsms-backend).
