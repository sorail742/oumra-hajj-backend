# Règles de code — backend

Complément pratique à `CLAUDE.md`/`AGENTS.md` (règles générales) et aux ADR
(décisions). Ce document répond à la question "comment j'écris ce code au
quotidien", pas "pourquoi cette architecture".

## Structure d'un module

Voir `architecture.md`. Un module = un dossier sous `src/modules/`, jamais
un contrôleur ajouté à un module existant qui ne le concerne pas
([ADR 0002](adr/0002-architecture-modulaire-nestjs.md)).

## Contrôleurs

- Un contrôleur ne fait que : valider (via DTO + `ValidationPipe` global),
  extraire `@CurrentUser()`, appeler le service, retourner son résultat.
- Aucune règle métier, aucun accès à Prisma/Mongoose directement dans un
  contrôleur.
- Toute route dont l'accès doit être restreint à un rôle porte
  `@Roles(Role.X, Role.Y)` explicitement. Pas de `@Roles()` = accessible à
  tout utilisateur authentifié (pas seulement au(x) rôle(s) "logique(s)") —
  si un rôle précis est attendu, il faut le déclarer.
- Une route publique (pas de JWT requis) porte `@Public()` explicitement.

## Services

- Toute la logique métier vit ici : règles, validations métier (pas la
  validation de forme, déjà faite par le DTO), orchestration entre modules.
- Un service qui a besoin d'un autre module l'importe via le service exporté
  de ce module (jamais l'accès direct à son modèle de données).
- Les vérifications de propriété/accès (ownership) sont des méthodes du
  service (`findAuthorizedOrFail`, `assertOwnership`, `assertAgencyOwnership`)
  — voir les modules `bookings`, `payments`, `documents`, `groups` comme
  référence.

## DTO

- Un DTO par action (`create-x.dto.ts`, `update-x.dto.ts`, jamais un DTO
  générique réutilisé pour tout).
- Toujours `class-validator` + `class-transformer`, jamais de validation
  manuelle dans le contrôleur.
- Chaque champ porte `@ApiProperty()`/`@ApiPropertyOptional()` (Swagger).

## Typage

- `strict: true` partout, pas de `any` non justifié (lint en erreur sur
  `@typescript-eslint/no-explicit-any` — voir `.eslintrc.js`).
- Les formes de réponse publiques de l'API vivent dans `src/types/`
  (`*Shape`), séparées du modèle de stockage — voir `api-versioning.md`.

## Accès aux données

Pendant la migration Prisma ([ADR 0013](adr/0013-migration-postgresql-prisma.md)) :

- Modules déjà migrés : injecter `PrismaService`, utiliser
  `this.prisma.<model>.findUnique(...)` etc.
- Modules pas encore migrés : injecter le `Model<T>` Mongoose via
  `@InjectModel` comme avant — ne pas migrer un module au fil de l'eau dans
  une PR non dédiée, voir `workflow.md`.
- Ne jamais mélanger les deux dans un même service.

## Erreurs

Utiliser les exceptions NestJS standard (`NotFoundException`,
`ForbiddenException`, `ConflictException`, `BadRequestException`,
`UnauthorizedException`) — jamais de `throw new Error(...)` brut dans un
service. Voir `error-codes.md` pour la correspondance code/situation.

## Sensibilité des données

- Aucune donnée sensible (documents pèlerins, secrets, clés API, données de
  paiement) dans un log, un message de commit ou un exemple de code (voir
  `CLAUDE.md`, `secrets-management.md`).
- Un accès en lecture à un document sensible doit être journalisé (voir
  `documents.service.ts`, logger `DocumentAccess`).

## Tests

Voir `testing.md`. En résumé : tout module touchant paiements, documents
sensibles ou bouton SOS nécessite un test avant merge (voir
[ADR 0010](adr/0010-strategie-tests.md), `CLAUDE.md`).

## Avant de proposer une Merge Request

1. `npm run lint` et `npm run test` passent sans erreur.
2. `npm run build` passe.
3. Toute décision d'architecture nouvelle est documentée par un ADR.
4. La branche suit `feature/<issue>-<titre>` ou `fix/<issue>-<titre>` — voir
   `workflow.md`.
