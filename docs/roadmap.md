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

## Terminé : migration MongoDB → PostgreSQL/Prisma

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
2. ✅ `agencies` — `AgencyValidationStatus` déplacé vers `common/enums`
   (vivait dans le schéma Mongoose qui a disparu avec ce module). Les 4
   modules Mongoose qui référençaient une `Agency` par `ObjectId`
   (`packages`, `bookings`, `groups`, `reviews`) ajustés en `String`, même
   changement mécanique qu'à l'étape précédente. Tables Postgres déjà
   présentes depuis la migration initiale, aucune nouvelle migration SQL
   nécessaire pour cette étape.
3. ✅ `packages` — `PilgrimageType`/`PackageStatus` déplacés vers
   `common/enums` (même raison qu'`AgencyValidationStatus`). Les 2 modules
   Mongoose qui référençaient un `Package` par `ObjectId` (`bookings`,
   `groups`) ajustés en `String`. `hotel` (Mongoose) aplati en colonnes
   `hotelName`/`hotelCity`/`hotelDistanceToMosqueM` côté Postgres,
   reconstruit en objet imbriqué dans `PackageShape` (même pattern que
   `bankDetails` pour `agencies`).
4. ✅ `groups` — module le plus complexe migré à ce jour : `itinerary` et
   `locations` (sous-documents Mongoose) deviennent des tables
   relationnelles dédiées (`GroupItineraryStep`, `GroupMemberLocation`),
   `members` devient une table de jointure (`GroupMember`,
   `@@unique([groupId, userId])`) plutôt qu'un tableau scalaire —
   `updateLocation` en profite pour devenir un `upsert` atomique sur cette
   contrainte unique au lieu d'un find-puis-remplace manuel. Le seul module
   Mongoose qui référençait un `Group` par `ObjectId` (`bookings`, champ
   `group`) ajusté en `String`. Couverture de tests élargie (le service
   n'avait auparavant que les tests du bouton SOS).
5. ✅ `bookings` — module le plus référencé à ce jour : `payments`,
   `documents` et `reviews` lisent tous des champs de `Booking`
   (`pilgrim`/`agency`/`package`/`_id`), pas seulement son id — leur accès
   à ces champs a dû être réécrit (`booking.pilgrim.toString()` →
   `booking.pilgrimId`, etc.) en plus du changement mécanique habituel sur
   leur propre champ `booking` (`ObjectId` → `String`). `steps`
   (sous-document Mongoose) devient une table relationnelle dédiée
   (`BookingStep`, `@@unique([bookingId, key])`) créée une fois pour
   toutes à la réservation (5 étapes fixes, jamais ajoutées/retirées) —
   `updateStep`/`markStepDone` deviennent de simples `update` sur cette
   contrainte unique. `BookingStatus`/`DossierStepKey`/`DossierStepStatus`
   déplacés vers `common/enums`. `IsMongoId` → `IsUUID` sur les 3 DTO qui
   valident un `bookingId` (`documents`, `payments`, `reviews`).
6. ✅ `payments`, `documents` — étape la plus contenue à ce jour : ni l'un
   ni l'autre n'est référencé par un autre module Mongoose (contrairement à
   `booking`), donc aucune ondulation en dehors des deux modules eux-mêmes.
   `PaymentMethod`/`PaymentStatus`/`PilgrimDocumentType`/
   `PilgrimDocumentStatus` déplacés vers `common/enums`. `IsMongoId` → `IsUUID`
   sur `bookingId` déjà fait au tour précédent (`documents`, `payments`,
   `reviews`) — rien à refaire ici.
7. ✅ `rites`, `notifications`, `reviews`, `admin` — dernière étape,
   la plus contenue avec `payments`/`documents` : le graphe Prisma des 4
   modules existait déjà depuis les fondations (aucune nouvelle migration
   SQL). `RiteSheetPilgrimageType`/`NotificationType` déplacés vers
   `common/enums`. Points d'implémentation notables : `RiteSheet.update()`
   utilise `version: { increment: 1 }` plutôt qu'un lire-puis-incrémenter ;
   `RiteProgress.syncBatch()` garde son pattern lecture-puis-upsert-conditionnel
   (pas d'équivalent Prisma en une seule requête pour "n'écraser que si plus
   récent") ; `Notification.send()` utilise `createManyAndReturn` (GA depuis
   Prisma 5.14) pour renvoyer les lignes créées ; `Notification.markRead()`
   vérifie l'appartenance via `findFirst` avant `update` (Prisma exige un
   critère unique). `admin` ne avait aucun schéma propre — seule une
   vérification était nécessaire, confirmée verte.

   **Migration module par module terminée** : plus aucun module métier ne
   référence Mongoose (`InjectModel`/`MongooseModule.forFeature` absents de
   tout `src/modules/`).
8. ✅ Nettoyage final Mongo — retrait de `MongooseModule.forRootAsync()`
   (`app.module.ts`), `mongoUri` (`configuration.ts`, `.env`/`.env.example`),
   des dépendances `mongoose`/`@nestjs/mongoose`/`mongodb-memory-server`
   (`package.json`) et de `test/utils/mongo-memory.ts` ; specs e2e (`health`,
   `auth`, `bookings`) débarrassées de leur setup/teardown Mongo ;
   `.gitlab-ci.yml`/`.gitignore` et documentation (`architecture.md`,
   `coding-rules-backend.md`, `api-versioning.md`, `testing.md`, `devops.md`,
   `README.md`, `CLAUDE.md`, `CURSOR.md`, `workflow.md`, `memory-system.md`,
   `auth-setup.md`) mis à jour pour ne plus décrire de coexistence
   Mongo/Postgres. Le backend ne dépend plus que de PostgreSQL/Prisma.

Chaque étape : schéma Prisma du domaine + migration SQL + service réécrit
(`PrismaService` au lieu de `Model<T>` Mongoose) + tests adaptés + Merge
Request revue.

## Ouvert — à trancher avant la suite

- **#15** ✅ Couverture de tests (`users`, `notifications`, `reviews`) complétée.
- **#16** ✅ Tranché — [ADR 0012](adr/0012-ci-cd-environnements.md) `accepté`
  (Render + SonarQube Cloud). Reste à faire, hors décision : créer les comptes
  Render/SonarQube Cloud, écrire les jobs de déploiement GitLab CI, configurer
  `SONAR_HOST_URL`/`SONAR_TOKEN`.
- **#17** 🟡 Brouillon des 13 fiches de rites committé
  (`docs/brouillon-fiches-rites.md`, badge "à valider" sur chaque fiche) pour
  débloquer le développement de l'écran mobile correspondant. **Reste
  réellement ouvert** : la validation par une personne qualifiée (voir
  `CLAUDE.md`, section "Contenu religieux") n'a pas eu lieu —
  `RiteSheet.isValidated` doit rester `false` pour toutes ces fiches tant que
  cette validation n'est pas faite, et aucune ne doit être intégrée en base
  ni présentée comme finale avant la mise en production.
- **#18** ✅ Tranché — [ADR 0006](adr/0006-gestion-paiements.md) `accepté`
  (CinetPay pour Mobile Money, Africa's Talking pour SMS/OTP et secours, FCM
  déjà accepté sans changement). Reste à faire, hors décision : devis réel
  Africa's Talking, comptes marchands/API keys, branchement des clés réelles
  en variables d'environnement.
- **#19** ✅ Messagerie pèlerin ↔ agence/guide implémentée (module `messaging`,
  [ADR 0014](adr/0014-messagerie-agence-guide.md)).

## Prochaines phases (cahier des charges §10, hors backend)

Rappel du découpage global du projet — hors périmètre de ce dépôt (backend
uniquement, voir `README.md`), utile pour situer où s'arrête ce dépôt :

| Phase | Contenu | Statut |
|---|---|---|
| 1 — Cadrage & UX | Personas, maquettes | Externe à ce dépôt |
| 2 — Backend & données | Ce dépôt | En cours — seul #17 (contenu religieux) reste ouvert |
| 3 — App mobile pèlerin | Flutter, dépôt séparé | Démarré (Stitch + implémentation) — API/messagerie disponibles |
| 4 — Espace agence & admin | Back-office web React | Non démarré |
| 5 — Intégrations & tests | Mobile Money (CinetPay), SMS (Africa's Talking), push (FCM) | Fournisseurs tranchés (ADR 0006) — mise en œuvre (comptes, clés) à faire |
| 6 — Pilote & déploiement | Agence pilote, prod | Hébergeur tranché (ADR 0012, Render) — mise en œuvre (déploiement CI) à faire |

## Politique de dépréciation API

Non encore formalisée (voir point ouvert dans `api-versioning.md` /
[ADR 0005](adr/0005-versionnement-api.md)) — à définir avant que l'app mobile
Flutter (Phase 3) ne commence à dépendre de l'API en production.
