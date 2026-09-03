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
  arbitraire comme `'booking-1'`. **Ne s'applique plus aux ids `User`** :
  depuis la migration Prisma de `users`/`auth` (ADR 0013), les champs qui
  référencent un pèlerin/guide/agence-owner/admin dans les modules encore
  Mongoose sont des `String` simples (UUID Postgres), pas des `ObjectId` —
  une fixture comme `'pilgrim-1'` y est parfaitement valide.

## Tests e2e (`test/*.e2e-spec.ts`)

- Utilisent une vraie instance de base de données **éphémère**, pas de mock.
  Deux mécanismes coexistent pendant la migration Prisma (ADR 0013) :
  `mongodb-memory-server` (`test/utils/mongo-memory.ts`) pour les modules pas
  encore migrés, et un conteneur Postgres éphémère
  (`test/utils/postgres-test-db.ts`, via `testcontainers`) pour les modules
  déjà sur Prisma (`users`, `auth`) — un fichier e2e qui touche les deux
  démarre les deux, voir `test/bookings/booking-journey.e2e-spec.ts`. En CI,
  Postgres est fourni par un service GitLab CI à la place de testcontainers
  (voir `devops.md` et `.gitlab-ci.yml`), détecté via `process.env.CI`
  (**pas** "`DATABASE_URL` est déjà définie" : importer `AppModule`
  déclenche `ConfigModule.forRoot()` dès l'évaluation du décorateur
  `@Module`, qui charge `.env` immédiatement — `DATABASE_URL` est donc déjà
  présente localement bien avant que le fichier de test ne s'exécute, même
  hors CI) — Docker requis en local pour lancer `npm run test:e2e`.
- `npm run test:e2e` exécute les fichiers **en série** (`--runInBand`), pas
  en parallèle : plusieurs `mongod` réels démarrés simultanément (un par
  fichier, via `mongodb-memory-server`) saturent facilement une machine de
  dev, et un run parallèle en CI partagerait une seule instance Postgres
  entre fichiers (risque de collision sur les contraintes uniques `phone`/
  `email`).
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
