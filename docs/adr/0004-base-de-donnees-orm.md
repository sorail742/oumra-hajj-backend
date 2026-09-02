# 0004 — Base de données et ODM

- **Statut** : remplacé — voir [0013](0013-migration-postgresql-prisma.md)
- **Date** : 2026-09-02

## Contexte

Le modèle de données (User, Agency, Package, Booking, Payment, Document, Group,
RiteProgress, Notification, Review) mélange des structures assez stables
(utilisateurs, forfaits) et des structures plus souples ou versionnées (contenu
des rites, historique d'étapes de dossier).

## Décision

MongoDB comme base de données, avec Mongoose comme ODM dans NestJS
(`@nestjs/mongoose`). Un schéma Mongoose par module, avec :

- Validation au niveau schéma (types, champs requis) **et** au niveau DTO
  (class-validator) côté contrôleur — la validation DTO est la première ligne de
  défense, le schéma Mongoose est la seconde.
- Index explicites sur les champs de recherche fréquents (téléphone, email,
  statut de réservation, agence).
- Pas de référence circulaire profonde entre collections : on préfère stocker un
  `ObjectId` de référence plutôt que d'imbriquer des documents volumineux.

## Conséquences

- Migration de schéma = changement de code applicatif (pas de migration SQL
  formelle) : toute évolution de schéma impactant des documents existants doit
  être accompagnée d'un script de migration versionné dans `scripts/migrations/`.
- Un changement futur vers PostgreSQL/Prisma (si des besoins transactionnels
  forts apparaissent, ex. paiements) devra faire l'objet d'un nouvel ADR.
