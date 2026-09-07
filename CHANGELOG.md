# Changelog

Historique des changements notables du backend. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), adapté : le projet
n'a pas encore de version publiée (aucun tag, `package.json` reste à
`0.0.1` — voir `docs/roadmap.md`, Phase 2 en cours). Les entrées sont donc
groupées par date plutôt que par version tant que le premier déploiement
(Phase 6, pilote) n'a pas eu lieu ; le versionnement sémantique démarrera à
ce moment-là.

Ne reflète que ce qui est fusionné dans `develop`. Le travail en cours sur
une branche `feature/*`/`fix/*` n'apparaît qu'une fois mergé — voir
`docs/workflow.md`.

## [Non publié]

Migration en cours du module `bookings` vers PostgreSQL/Prisma
([ADR 0013](docs/adr/0013-migration-postgresql-prisma.md)) —
`feature/29-prisma-bookings`, voir `docs/roadmap.md`.

## 2026-09-06

### Modifié

- Migration du module `groups` vers PostgreSQL/Prisma : `itinerary` et
  `locations` deviennent des tables relationnelles dédiées
  (`GroupItineraryStep`, `GroupMemberLocation`), `members` devient une table
  de jointure (`GroupMember`) avec upsert atomique pour `updateLocation`
  ([ADR 0013](docs/adr/0013-migration-postgresql-prisma.md)).

## 2026-09-03

### Ajouté

- Fondations Prisma : schéma complet (`prisma/schema.prisma`),
  `PrismaService`, configuration associée
  ([ADR 0013](docs/adr/0013-migration-postgresql-prisma.md)).
- `src/types/` peuplé avec les contrats de réponse API par domaine (`*Shape`)
  — référence de contrat pour le web et le mobile (voir `docs/api-versioning.md`).
- ADR 0013 (migration PostgreSQL/Prisma), qui remplace l'ADR 0004.
- Documentation d'ingénierie backend (`docs/architecture.md`,
  `docs/auth-flow.md`, `docs/testing.md`, `docs/error-codes.md`, etc.).

### Modifié

- Migration des modules `users`/`auth` puis `agencies` puis `packages` vers
  PostgreSQL/Prisma, module par module ([ADR 0013](docs/adr/0013-migration-postgresql-prisma.md)) ;
  les modules encore Mongoose qui référençaient ces entités par `ObjectId`
  sont ajustés pour stocker des `String` (UUID Postgres) — voir
  `docs/roadmap.md` pour le détail par étape.
- Tests e2e éclatés par domaine (`test/<domaine>/*.e2e-spec.ts`), remplaçant
  `app.e2e-spec.ts` ; ajout du parcours réservation + paiement.
- Image Node de la CI alignée sur Node 24 (environnement de développement).

## 2026-09-02

### Ajouté

- Initialisation du backend NestJS de la plateforme Oumra & Hadj (12 modules
  métier + `auth`, DTO, schémas Mongoose).
- Pipeline GitLab CI : lint, tests unitaires, tests e2e, build, analyse
  SonarQube (non bloquante — voir `docs/devops.md`).
- Tests unitaires : logique de places (`packages`) et de réservations
  (`bookings`), validation des agences, module `rites`.

### Modifié

- Remplacement du README monorepo par un README backend autonome.
