# Stratégie de tests

Référence : [ADR 0010](adr/0010-strategie-tests.md) (accepté).

## Commandes

| Commande | Effet |
|---|---|
| `npm run test` | Tests unitaires (Jest) |
| `npm run test:cov` | Idem + rapport de couverture (`coverage/`) |
| `npm run test:e2e` | Tests end-to-end (`test/*.e2e-spec.ts`) |
| `npm run lint:ci` | Lint strict, sans auto-fix, utilisé en CI |

## Tests unitaires (`*.service.spec.ts`)

- Le modèle de données (`Model<T>` Mongoose, ou `PrismaService` après
  migration) est **toujours mocké** via `getModelToken`/`useValue` — jamais
  de connexion réelle dans un test unitaire.
- Les autres services dont dépend le service testé sont mockés également
  (`useValue` avec des `jest.fn()`) — un test unitaire de `PaymentsService`
  ne doit pas exécuter le vrai code de `BookingsService`.
- Priorité de couverture (voir `CLAUDE.md`) : tout module touchant aux
  **paiements**, aux **documents sensibles** ou au **bouton SOS** nécessite
  un test avant merge. C'est non négociable, contrairement au reste où la
  couverture est souhaitable mais peut suivre.
- Piège classique : `new Types.ObjectId(id)` (Mongoose) lève si `id` n'est
  pas un hex 24 caractères valide — dans les fixtures de test, toujours
  utiliser `new Types.ObjectId().toString()` plutôt qu'une chaîne
  arbitraire comme `'booking-1'`.

## Tests e2e (`test/*.e2e-spec.ts`)

- Utilisent une vraie instance de base de données **éphémère**, pas de mock
  — actuellement `mongodb-memory-server` (MongoDB en mémoire, aucune
  dépendance externe requise en CI). Après la migration Prisma (ADR 0013),
  une base PostgreSQL de test dédiée sera utilisée à la place (voir
  `devops.md`).
- `setupApp()` (`src/setup-app.ts`) applique exactement la même
  configuration (préfixe, versioning, sécurité) qu'en production — les
  tests e2e appellent les vraies routes versionnées (`/api/v1/...`).
- Un test e2e vérifie un **parcours complet**, pas un cas unitaire isolé —
  voir `test/app.e2e-spec.ts` (inscription OTP, accès protégé) comme
  gabarit.

## Seuil de couverture

Pas encore de seuil strict imposé en CI — objectif indicatif ~70% sur
`payments`, `bookings`, `documents` (voir ADR 0010). Le rapport `cobertura`
est publié par le pipeline (`unit-tests` job) et visible dans les Merge
Requests GitLab (diff de couverture par ligne changée).

## Ce qui ne doit jamais être fait

- Désactiver un test existant pour faire passer la CI sans justification
  explicite dans la description de la Merge Request (voir `CLAUDE.md`).
- Générer de fausses données de paiement ou de documents d'identité
  réalistes dans un test — utiliser des jeux de données factices explicites
  (ex. `+224620000000`, `dev-<uuid>` comme référence de transaction).
