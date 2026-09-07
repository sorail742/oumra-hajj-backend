# 0013 — Migration de MongoDB/Mongoose vers PostgreSQL/Prisma

- **Statut** : accepté
- **Date** : 2026-09-03
- **Décideurs** : Sory KEITA (dev)
- **Remplace** : [0004 — Base de données et ODM](0004-base-de-donnees-orm.md) (accepté)
- **Impacte** : [0001 — Choix de la stack technique globale](0001-choix-stack-technique.md) (accepté), qui mentionnait MongoDB/Mongoose comme partie de la stack retenue

## Contexte

L'ADR 0004 (accepté) avait retenu MongoDB + Mongoose, cohérent avec la stack
habituelle de la structure et adapté à des documents hétérogènes (dossiers
pèlerins, contenu religieux versionné). Le backend a depuis été implémenté
intégralement sur cette base : 12 modules métier, schémas Mongoose, DTO
validés, 46 tests unitaires + e2e, pipeline CI GitLab fonctionnel.

Le donneur d'ordre (Sory KEITA) demande de basculer vers **PostgreSQL**
comme base de données et **Prisma** comme ORM. Cette décision inverse un
choix déjà accepté ; conformément à `CLAUDE.md` ("Ne pas changer de base de
données [...] sans ADR validé au préalable"), elle est documentée ici avant
toute réécriture du code, et reste au statut `proposé` tant qu'elle n'a pas
été confirmée.

## Décision proposée

- Remplacer MongoDB/Mongoose par **PostgreSQL** + **Prisma** (`@prisma/client`,
  `prisma` en devDependency) comme base de données et ORM du backend.
- Un schéma Prisma unique (`prisma/schema.prisma`) définissant les modèles
  relationnels équivalents aux collections actuelles (`User`, `Agency`,
  `Package`, `Booking`, `Payment`, `PilgrimDocument`, `RiteSheet`,
  `RiteProgress`, `Group`, `Notification`, `Review`, `Otp`, `RefreshToken`),
  avec clés étrangères explicites remplaçant les `ObjectId` de référence.
- Migrations SQL versionnées via `prisma migrate` (`prisma/migrations/`),
  remplaçant la convention `scripts/migrations/` prévue par l'ADR 0004 pour
  les évolutions de schéma Mongoose.
- Chaque service métier (`*.service.ts`) est réécrit pour utiliser
  `PrismaService` (wrapper `PrismaClient` injectable) au lieu d'un
  `Model<T>` Mongoose injecté via `@InjectModel`.
- La validation DTO (`class-validator`) est conservée à l'identique — elle
  reste la première ligne de défense, indépendante de l'ORM.
- Les champs actuellement modélisés en sous-documents Mongoose (ex.
  `Booking.steps`, `Group.locations`, `Group.itinerary`) deviennent soit des
  tables relationnelles dédiées (relation 1-N), soit des colonnes `Json`
  Prisma quand une relation dédiée n'apporte pas de valeur (à trancher au cas
  par cas pendant l'implémentation).

## Conséquences

- **Réécriture complète de la couche de persistance** : les 12 modules
  métier existants (schémas, services, tests unitaires qui mockent
  actuellement `Model<T>`) doivent être adaptés pour mocker `PrismaService`
  à la place. Les tests e2e (MongoDB en mémoire via `mongodb-memory-server`)
  doivent être remplacés par une base PostgreSQL de test (conteneur Docker
  ou instance éphémère) — `mongodb-memory-server` devient obsolète.
- Nécessite une instance PostgreSQL par environnement (dev/staging/prod) —
  impacte le pipeline CI (`.gitlab-ci.yml`, service `postgres:` à ajouter) et
  le choix d'hébergeur encore ouvert (voir ADR 0012).
- Les relations explicites (clés étrangères) apportent des garanties
  d'intégrité référentielle plus fortes que les `ObjectId` non contraints de
  Mongoose — pertinent pour les données financières (`payments`) et les
  documents sensibles (`documents`), mais impose une réflexion sur les
  cascades de suppression (ex. suppression d'un compte pèlerin).
- Le contenu religieux versionné (`RiteSheet.version`) et les sous-documents
  flexibles (`emergencyContact`, `bankDetails`) restent modélisables via des
  colonnes `Json` Prisma si une normalisation complète n'est pas justifiée.
- Ampleur du changement : il s'agit d'une réécriture, pas d'un ajout —
  l'exécution doit suivre le nouveau workflow (une branche par module migré,
  tests verts, Merge Request, revue) plutôt qu'un unique commit massif, pour
  rester revuable et ne pas casser `develop` en cours de route.

## Alternative envisagée

Conserver MongoDB/Mongoose (statu quo de l'ADR 0004) : rejetée par décision
explicite du donneur d'ordre, sans lien avec une limite technique constatée
sur l'implémentation existante.

## Validation

Confirmé le 2026-09-03 par Sory KEITA. Exécution retenue : migration
**module par module** (une branche par module migré, tests adaptés, Merge
Request revue avant fusion dans `develop`) plutôt qu'une réécriture en un
seul passage, pour garder le backend utilisable entre chaque étape — voir
suivi dans les issues GitLab dédiées.
