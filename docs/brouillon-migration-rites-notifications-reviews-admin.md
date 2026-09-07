# Brouillon — Étape 7 : migration Prisma de `rites`, `notifications`, `reviews`, `admin`

> Document de préparation, **lecture seule** sur le code (aucun fichier sous
> `src/` modifié, aucune branche ouverte). Objectif : documenter ce qu'il y a
> à faire avant d'attaquer l'implémentation de l'étape 7 de
> [`docs/roadmap.md`](roadmap.md), une fois l'étape 6 (`payments`,
> `documents`) fusionnée dans `develop`. Suit le pattern déjà utilisé pour
> `groups`/`packages`/`agencies`/`bookings` (voir
> [ADR 0013](adr/0013-migration-postgresql-prisma.md)).

## Constat de départ — le terrain est déjà largement préparé

Contrairement à l'exercice habituel des étapes précédentes, **le schéma
Prisma des 4 modules existe déjà** dans `prisma/schema.prisma` (`RiteSheet`,
`RiteProgress`, `Notification`, `Review`, lignes 412 à 486) : le fichier a
été écrit dès la fondation (étape 1) pour couvrir tout le graphe relationnel
d'un coup, chaque module ne se « branchant » sur Prisma qu'au moment de sa
propre migration (voir l'en-tête du fichier). La migration SQL initiale
(`prisma/migrations/20260903130648_init/migration.sql`) a déjà créé les
tables Postgres correspondantes (`rite_sheets`, `rite_progress`,
`notifications`, `reviews`) — vérifié, elles sont bien présentes dans le
fichier de migration.

De même, les champs qui référencent un module déjà migré (`User`,
`Agency`, `Booking`) sont **déjà** en `String` dans les schémas Mongoose
actuels de ces 4 modules — ajustés mécaniquement lors des étapes 1
(`users`/`auth`), 2 (`agencies`) et 5 (`bookings`), comme documenté dans
`docs/roadmap.md`. Confirmé en lisant les schémas actuels : `RiteSheet.
validatedBy`, `RiteProgress.pilgrim`, `Notification.recipient`,
`Review.pilgrim`/`agency`/`booking` portent tous déjà le commentaire « Id
Postgres (UUID) depuis la migration Prisma de [module] ».

**Conséquence pratique** : contrairement à `bookings` (étape 5, la plus
lourde à ce jour), l'étape 7 ne nécessite **ni nouveau modèle Prisma, ni
nouvelle migration SQL, ni ripple `ObjectId → String`** sur d'autres
modules. Le travail se limite à réécrire les 4 services Mongoose
(`Model<T>` injecté) vers `PrismaService`, adapter les tests qui les
mockent, et vérifier les DTO. C'est plus proche en volume de l'étape 2
(`agencies`) que de l'étape 5.

---

## `rites` — `RiteSheet`

### Schéma Mongoose actuel (`src/modules/rites/schemas/rite-sheet.schema.ts`)

Document plat, aucun sous-document ni tableau : `key`, `title`,
`pilgrimageType` (enum), `order`, `content`, `audioRef?`, `language`,
`version`, `isValidated`, `validatedBy?` (déjà `String`), `validatedAt?`,
+ `timestamps: true`.

### Modèle Prisma équivalent (déjà présent, `schema.prisma:412-431`)

Mapping direct 1:1, `validatedById` + relation `validatedBy User?` vers
`User` (`@relation("RiteSheetValidatedBy")`). Rien à concevoir.

### Ce qui change côté service (`rite-sheets.service.ts`)

- `create()` : `riteSheetModel.create()` → `prisma.riteSheet.create({ data: { ...dto, isValidated: false } })`, mécanique.
- `update()` / `validate()` : le code actuel **mute le document Mongoose
  en mémoire puis appelle `.save()`** — pattern à abandonner, pas
  d'équivalent direct Prisma. À réécrire en `prisma.riteSheet.update({
  where: { id }, data: { ...dto, isValidated: false, validatedById: null,
  validatedAt: null, version: { increment: 1 } } })` (utiliser
  `{ increment: 1 }` plutôt que lire-puis-incrémenter, pattern déjà
  disponible côté Prisma et plus sûr en concurrence).
- `findByIdOrFail()` : `findById().exec()` + throw manuel →
  `prisma.riteSheet.findUnique({ where: { id } })` + `NotFoundException`
  (même pattern que `UsersService.findByIdOrFail`).
- `listPublished()` : le filtre Mongo `{ $in: [pilgrimageType, 'both'] }`
  devient `{ in: [pilgrimageType, 'both'] }` côté Prisma (`where`), rien de
  structurel.
- DTO (`CreateRiteSheetDto`/`UpdateRiteSheetDto`) : aucun champ ne valide
  un id Mongo (`id` arrive en `@Param()` brut, non typé côté DTO) — rien à
  changer ici, contrairement à `documents`/`payments`/`reviews` à l'étape 5.
- Rappel CLAUDE.md (« Contenu religieux ») : la contrainte « toute fiche
  reste `à valider par une personne qualifiée` tant que `isValidated` n'a
  pas été mis à `true` explicitement » ne change pas avec la migration —
  à ne pas perdre de vue en réécrivant `update()`/`validate()`.

## `rites` — `RiteProgress`

### Schéma Mongoose actuel

Plat également : `pilgrim` (déjà `String`), `riteKey`, `completed`,
`tawafCount`, `saiCount`, `clientUpdatedAt`, + `timestamps: true`, index
unique `(pilgrim, riteKey)`.

### Modèle Prisma équivalent (déjà présent, `schema.prisma:433-447`)

Mapping direct, `pilgrimId` + relation `pilgrim User`, même contrainte
`@@unique([pilgrimId, riteKey])` — donc même clé composite auto-générée
`pilgrimId_riteKey` par Prisma, à utiliser dans les `where` (voir
`groups.service.ts:218`, `where: { groupId_userId: { ... } }`, même
pattern déjà en place dans le code).

### Ce qui change côté service (`rite-progress.service.ts`)

- `findMine()` : direct, `findMany({ where: { pilgrimId } })`.
- `syncBatch()` : la logique de résolution de conflit (« n'écrase que si
  `clientUpdatedAt` du lot est plus récent que celui en base », voir
  ADR 0007) **n'a pas d'équivalent Prisma en une seule requête** — un
  `upsert()` Prisma applique toujours `update` si la ligne existe, sans
  condition sur un autre champ. Recommandation : garder le pattern actuel
  en deux temps (lecture via `findUnique({ where: { pilgrimId_riteKey:
  {...} } })`, comparaison en mémoire, puis `upsert()` seulement si plus
  récent ou absent) plutôt que de chercher à forcer une opération atomique
  unique — c'est un point à documenter explicitement dans la
  Merge Request pour ne pas surprendre le relecteur.
- `resetCounter()` : upsert direct sur la même clé composite, sans
  condition de conflit — plus simple.
- Aucun changement de DTO nécessaire (`SyncRiteProgressDto` ne valide pas
  d'id Mongo).

---

## `notifications`

### Schéma Mongoose actuel (`notification.schema.ts`)

Plat, aucun sous-document : `recipient` (déjà `String`), `type` (enum),
`title`, `content`, `isCritical`, `readAt?`, + `timestamps: true` (mais
seul `createdAt` est exposé/utilisé, pas `updatedAt`).

### Modèle Prisma équivalent (déjà présent, `schema.prisma:453-466`)

Mapping direct, `recipientId` + relation `recipient User`. Le modèle
Prisma n'a volontairement que `createdAt` (pas `updatedAt`) — cohérent
avec l'usage actuel.

### Ce qui change côté service (`notifications.service.ts`)

- `send()` : `notificationModel.insertMany(...)` renvoie les documents
  créés ; **`prisma.notification.createMany()` ne renvoie pas les lignes
  créées sur Postgres**. Deux options à trancher en implémentant :
  1. `prisma.notification.createManyAndReturn({ data: [...] })` si
     disponible et stable dans la version de Prisma épinglée
     (`@prisma/client ^7.10.0` — à vérifier au moment de coder, la
     fonctionnalité existe côté Postgres depuis Prisma 5.14) ;
  2. sinon, repli sur `Promise.all(recipientIds.map(id => prisma.notification.create({ data: {...} })))`.
  Le contrat de retour `Promise<NotificationShape[]>` doit être préservé
  dans les deux cas.
- Le `dispatch()` fire-and-forget (push puis SMS de secours si critique et
  push non délivré, voir ADR 0009) ne touche pas Mongoose/Prisma
  directement — inchangé.
- `listForUser()` : `find(filter).sort().exec()` → `findMany({ where,
  orderBy: { createdAt: 'desc' } })`. Le filtre Mongo `readAt: { $exists:
  false }` devient simplement `readAt: null` côté Postgres (colonne
  nullable, pas d'opérateur `$exists` à traduire).
- `markRead()` : le filtre Mongo combine deux critères non-uniques
  ensemble (`_id` + `recipient`, pour vérifier l'appartenance) — Prisma
  `update()` exige un critère unique (`id` seul suffit ici), donc la
  vérification d'appartenance doit être faite autrement. Deux options à
  trancher en implémentant :
  1. `updateMany({ where: { id, recipientId }, data: { readAt } })` puis
     vérifier `count === 0` pour lever `NotFoundException` ;
  2. `findFirst({ where: { id, recipientId } })` puis `update()` si
     trouvé.
  Le point commun avec l'étape 5 (`payments.handleWebhook`) est le même
  genre de traduction filtre-composite → contrôle explicite avant l'appel
  Prisma — pas un cas nouveau dans ce projet.
- Aucun DTO ne valide d'id Mongo dans ce module (id de notification en
  `@Param()` brut) — rien à changer côté validation.

---

## `reviews`

### Schéma Mongoose actuel (`review.schema.ts`)

Plat, aucun sous-document : `pilgrim`, `agency`, `booking` (tous les trois
déjà `String`, `booking` avec contrainte `unique`), `rating`, `comment?`,
+ `timestamps: true` (mais seul `createdAt` est exposé dans `ReviewShape` —
cohérent avec le fait qu'un avis n'est jamais modifié après création dans
le service actuel).

### Modèle Prisma équivalent (déjà présent, `schema.prisma:472-486`)

Mapping direct, `pilgrimId`/`agencyId`/`bookingId` (`@unique`) + relations.
Même remarque que ci-dessus : pas d'`updatedAt` dans le modèle — à
confirmer que c'est un choix assumé (avis immuable) plutôt qu'un oubli,
avant de fermer ce point en implémentant.

### Ce qui change côté service (`reviews.service.ts`)

- `create()` : `bookingsService.findByIdOrFail()` est déjà sur Prisma
  (migré à l'étape 5) — aucun changement de ce côté. La vérification
  d'unicité (`reviewModel.findOne({ booking: booking.id }).exec()`) devient
  `prisma.review.findUnique({ where: { bookingId: booking.id } })`
  (`bookingId` est déjà `@unique` dans le modèle Prisma, donc `findUnique`
  s'applique directement — plus direct que le `findOne` Mongoose actuel).
  `reviewModel.create({...})` → `prisma.review.create({ data: {...} })`,
  mécanique.
- `listByAgency()` / `findMine()` : `find(filter).exec()` →
  `findMany({ where, orderBy: { createdAt: 'desc' } })` (le tri existe déjà
  côté `listByAgency`, absent de `findMine` — à garder tel quel, pas un
  changement introduit par la migration).
- DTO : `CreateReviewDto.bookingId` est **déjà** en `@IsUUID()` — corrigé
  lors de l'étape 5 (« `IsMongoId → IsUUID` sur les 3 DTO qui valident un
  `bookingId` », `docs/roadmap.md` étape 5). Rien à faire ici.

C'est le module le plus simple des quatre : aucun point ouvert identifié.

---

## `admin`

`AdminService` n'a **aucun schéma, aucune collection propre** — c'est un
agrégateur pur au-dessus de `UsersService`, `AgenciesService`,
`BookingsService`, `PaymentsService` (voir `admin.service.ts`), conforme à
la règle CLAUDE.md « pas d'accès direct à Mongoose depuis un contrôleur »
appliquée ici au niveau service. Les quatre services dont il dépend sont
déjà (ou seront, à la fin de l'étape 6) intégralement sur Prisma.

**Conséquence** : il n'y a rien à concevoir ni migrer pour `admin`
lui-même — pas de modèle Prisma, pas de migration SQL, pas de réécriture
de service attendue. Le seul travail restant est une **vérification**
(tests `admin.service` toujours verts une fois les 4 dépendances migrées)
plutôt qu'une implémentation. À noter dans la roadmap/l'issue #7 pour ne
pas ouvrir une branche pour rien : `admin` peut être clos par une simple
vérification à la fin de l'étape 7, pas par une Merge Request de migration
dédiée.

---

## Ordre d'implémentation suggéré et points ouverts

Suggestion d'ordre (du plus simple au plus délicat, dépendances déjà
toutes migrées donc pas de contrainte d'ordre imposée par le graphe) :
`reviews` → `notifications` → `rites` (`RiteSheet` puis `RiteProgress`) →
vérification `admin`.

Points à trancher pendant l'implémentation (pas de blocage pour démarrer,
mais à ne pas découvrir en cours de Merge Request) :

1. **`Review`/`RiteSheet`/`Notification` sans `updatedAt` exposé** — confirmer
   que c'est un choix assumé (entités jamais modifiées après création côté
   API) plutôt qu'un oubli du schéma Prisma initial.
2. **`Notification.send()` — retour de `createMany`** — vérifier si
   `createManyAndReturn` est disponible/stable dans la version de Prisma
   du projet avant de s'appuyer dessus ; sinon repli sur `Promise.all` de
   `create()`.
3. **`Notification.markRead()` — contrôle d'appartenance** — choisir entre
   `updateMany` + vérification de `count`, ou `findFirst` + `update`.
4. **`RiteProgress.syncBatch()` — résolution de conflit par horodatage
   client** — pas d'équivalent Prisma en une seule requête ; garder le
   pattern actuel en deux temps (lecture, comparaison, upsert conditionnel)
   plutôt que de le forcer en une opération atomique.

Aucun de ces points ne remet en cause le modèle Prisma déjà écrit ni ne
nécessite une nouvelle migration SQL — ce sont des décisions
d'implémentation au niveau service, à documenter dans la description de
Merge Request de chaque module comme le veut le workflow existant (voir
ADR 0013, section Validation).
