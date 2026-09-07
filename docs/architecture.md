# Architecture backend

Vue d'ensemble pratique de l'architecture du backend. Les décisions
structurantes elles-mêmes sont dans `docs/adr/` — ce document explique
comment elles s'articulent concrètement dans le code.

## Vue logique

```
App mobile (Flutter)         Back-office web (React)
  pèlerin / guide               agence / admin
        \                          /
         \                        /
          v                      v
         API centrale NestJS (/api/v1)
                    |
      +-------------+-------------+
      |             |             |
  PostgreSQL     Provider(s)   Provider(s)
  (Prisma)     paiement       push/SMS/stockage
  voir ADR 0013  (ADR 0006)    (ADR 0008/0009)
```

## Stack

Voir [ADR 0001](adr/0001-choix-stack-technique.md) et
[ADR 0013](adr/0013-migration-postgresql-prisma.md) pour l'historique complet.

- NestJS + TypeScript strict
- PostgreSQL + Prisma (ORM) — voir [ADR 0013](adr/0013-migration-postgresql-prisma.md)
- Auth JWT (access + refresh), OTP pèlerin/guide, email+mot de passe
  agence/admin ([ADR 0003](adr/0003-strategie-authentification.md))
- Documentation API : Swagger/OpenAPI sur `/api/docs` (hors production)

## Organisation du code

Un module NestJS par domaine métier, sous `src/modules/<domaine>/`
([ADR 0002](adr/0002-architecture-modulaire-nestjs.md)) :

```
src/modules/<domaine>/
  <domaine>.module.ts
  <domaine>.controller.ts    # validation + appel service, jamais de logique métier
  <domaine>.service.ts       # logique métier, seul point d'accès aux données
  dto/                       # DTO entrée/sortie, validés par class-validator
  *.controller.spec.ts
  *.service.spec.ts
```

Modules métier : `auth`, `users`, `agencies`, `packages`, `bookings`,
`payments`, `documents`, `rites`, `groups`, `notifications`, `reviews`,
`admin`, `health`.

`src/common/` centralise les guards (`JwtAuthGuard`, `RolesGuard`), décorateurs
(`@Roles`, `@Public`, `@CurrentUser`) et le filtre d'exception global.

`src/types/` centralise les formes de réponse HTTP publiques de l'API,
indépendantes du détail de stockage — voir `api-versioning.md`.

## Graphe de dépendances entre modules

Une dépendance transverse passe toujours par un service exporté
explicitement (jamais d'accès direct au schéma/modèle d'un autre module) :

```
users          <- auth, agencies, groups, documents (accès profil)
agencies       <- packages, bookings, documents, payments, groups (ownership)
packages       <- bookings
groups         <- bookings (assignation), notifications (SOS)
bookings       <- payments, documents, reviews
notifications  <- groups (SOS), (tout module pouvant notifier)
```

Aucune dépendance circulaire : si un module A a besoin d'un module B, B ne
doit jamais réimporter A.

## Flux d'une requête type

1. `JwtAuthGuard` (global) : authentifie via JWT, laisse passer les routes
   `@Public()`.
2. `RolesGuard` (global) : vérifie `@Roles(...)` si présent sur la route.
3. `ValidationPipe` (global) : valide et transforme le DTO d'entrée.
4. Contrôleur : appelle le service, ne contient aucune règle métier.
5. Service : logique métier, accès aux données via Prisma, appelle d'autres
   services si besoin.
6. `HttpExceptionFilter` (global) : formalise toute erreur en réponse JSON
   cohérente (voir `error-codes.md`).
