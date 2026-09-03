# Roadmap backend

État réel du backend et suite prévue. Le détail exécutable vit dans les
issues GitLab du projet ; ce document donne la vue d'ensemble et l'ordre.

## Où en est le backend (Phase 2 du plan de développement, cahier des charges §10)

Les 12 modules métier + auth sont implémentés, testés et fusionnés dans
`develop` : `auth`, `users`, `agencies`, `packages`, `bookings`, `payments`,
`documents`, `rites`, `groups`, `notifications`, `reviews`, `admin` — voir
les issues #1 à #14 (fermées) pour le détail par module et leurs critères
d'acceptation.

Pipeline CI en place (`devops.md`), documentation API Swagger en place
(`api-versioning.md`), workflow Git normalisé (`workflow.md`).

## En cours : migration MongoDB → PostgreSQL/Prisma

Décidée par [ADR 0013](adr/0013-migration-postgresql-prisma.md) (accepté),
exécutée **module par module** (une branche + une Merge Request par module,
pas de réécriture en un seul passage — voir `workflow.md`).

Ordre retenu (dépendances d'abord) :

1. ✅ Fondations Prisma (`prisma/schema.prisma` complet, `PrismaService`) +
   `users` + `auth` (`Otp`, `RefreshToken`) — module dont dépendent tous les
   autres. Les 7 autres modules encore Mongoose qui référençaient un `User`
   par `ObjectId` (`agencies`, `bookings`, `documents`, `reviews`,
   `notifications`, `rites`, `groups`) ont été ajustés pour stocker ces ids
   en `String` (UUID Postgres) au lieu d'`ObjectId` — changement mécanique,
   aucune logique métier modifiée. Infra de test Postgres mise en place
   (`prisma/migrations/`, `test/utils/postgres-test-db.ts` via
   `testcontainers`, service `postgres:` en CI).
2. `agencies` — **prochaine étape** : migrer réellement le module (collection
   `agencies` elle-même) vers Prisma, pas seulement ses références à `User`
3. `packages`
4. `groups`
5. `bookings`
6. `payments`, `documents`
7. `rites`, `notifications`, `reviews`, `admin`

Chaque étape : schéma Prisma du domaine + migration SQL + service réécrit
(`PrismaService` au lieu de `Model<T>` Mongoose) + tests adaptés + Merge
Request revue.

## Ouvert — à trancher avant la suite

Voir issues #15 à #18 (ouvertes) pour le détail :

- **#15** Compléter la couverture de tests (`users`, `notifications`, `reviews`)
- **#16** Confirmer l'ADR 0012 (CI/CD), provisionner SonarQube, choisir
  l'hébergeur de production
- **#17** Rédiger et faire valider les vraies fiches de rites (contenu
  religieux — aucune fiche réelle en base actuellement)
- **#18** Choisir les fournisseurs SMS/OTP, paiement Mobile Money et FCM
  (ADR 0006 non tranché)

## Prochaines phases (cahier des charges §10, hors backend)

Rappel du découpage global du projet — hors périmètre de ce dépôt (backend
uniquement, voir `README.md`), utile pour situer où s'arrête ce dépôt :

| Phase | Contenu | Statut |
|---|---|---|
| 1 — Cadrage & UX | Personas, maquettes | Externe à ce dépôt |
| 2 — Backend & données | Ce dépôt | En cours (migration DB) |
| 3 — App mobile pèlerin | Flutter, dépôt séparé | Non démarré (dépend du contrat API — voir `api-versioning.md`) |
| 4 — Espace agence & admin | Back-office web React | Non démarré |
| 5 — Intégrations & tests | Mobile Money, push, géoloc | Bloqué par issue #18 |
| 6 — Pilote & déploiement | Agence pilote, prod | Bloqué par issue #16 |

## Politique de dépréciation API

Non encore formalisée (voir point ouvert dans `api-versioning.md` /
[ADR 0005](adr/0005-versionnement-api.md)) — à définir avant que l'app mobile
Flutter (Phase 3) ne commence à dépendre de l'API en production.
