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

- `PrismaService` est **toujours mocké** (`useValue` avec des `jest.fn()`
  par modèle utilisé) — jamais de connexion réelle dans un test unitaire.
- Les autres services dont dépend le service testé sont mockés également
  (`useValue` avec des `jest.fn()`) — un test unitaire de `PaymentsService`
  ne doit pas exécuter le vrai code de `BookingsService`.
- Priorité de couverture (voir `CLAUDE.md`) : tout module touchant aux
  **paiements**, aux **documents sensibles** ou au **bouton SOS** nécessite
  un test avant merge. C'est non négociable, contrairement au reste où la
  couverture est souhaitable mais peut suivre.
- Tous les ids sont des UUID Postgres (`String` côté Prisma) — une fixture
  comme `'pilgrim-1'` ou `'booking-1'` est une chaîne arbitraire parfaitement
  valide, aucun format particulier à respecter dans les mocks.

## Tests e2e (`test/*.e2e-spec.ts`)

- Utilisent une vraie instance Postgres **éphémère**, pas de mock
  (`test/utils/postgres-test-db.ts`, via `testcontainers`) — une instance
  fraîche par fichier de test en local (Docker requis), `prisma migrate
  deploy` appliqué automatiquement dessus. En CI, Postgres est fourni par un
  service GitLab CI à la place de testcontainers (voir `devops.md` et
  `.gitlab-ci.yml`), détecté via `process.env.CI` (**pas** "`DATABASE_URL`
  est déjà définie" : importer `AppModule` déclenche
  `ConfigModule.forRoot()` dès l'évaluation du décorateur `@Module`, qui
  charge `.env` immédiatement — `DATABASE_URL` est donc déjà présente
  localement bien avant que le fichier de test ne s'exécute, même hors CI).
- `npm run test:e2e` exécute les fichiers **en série** (`--runInBand`), pas
  en parallèle : en CI, tous les fichiers partagent une seule instance
  Postgres (risque de collision sur les contraintes uniques `phone`/`email`
  si exécutés en parallèle).
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
