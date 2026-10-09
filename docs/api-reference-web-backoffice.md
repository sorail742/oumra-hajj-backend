# Référence API — back-office web (agence / admin)

Document de référence pour la fenêtre Claude travaillant sur le
**frontend web React** (back-office agences + admin). Contenu vérifié
directement dans le code du backend (contrôleurs, DTO, `src/types/`) à la
date ci-dessous — **pas** le cahier des charges, qui décrit des
fonctionnalités pas toutes implémentées.

Dernière vérification : 2026-09-05, backend `feature/27-prisma-groups`
(migration Prisma en cours, voir section "État de la migration" en bas).

## Base commune

- Base URL : `http://<host>/api/v1` (préfixe `api` + versionnement URI,
  `src/setup-app.ts`). Pas d'autre version que `v1` aujourd'hui.
- Auth : `Authorization: Bearer <accessToken>` JWT sur toute route sauf
  `@Public()` (listées explicitement ci-dessous).
- Format d'erreur (`docs/error-codes.md`) :
  ```json
  { "statusCode": 404, "timestamp": "...", "path": "/api/v1/...", "message": "..." }
  ```
  `message` = string ou tableau de strings (erreurs de validation, une par
  champ).
- Codes : 400 (DTO/règle invalide), 401 (JWT invalide, identifiants
  incorrects, compte suspendu), 403 (pas propriétaire de la ressource),
  404 (introuvable), 409 (conflit d'état : email déjà utilisé, agence non
  validée, forfait complet, avis déjà posé).
- **Aucun endpoint de suppression n'existe** sur aucune ressource — pas de
  DELETE dans toute l'API actuelle. Pas de pagination non plus sur aucune
  liste (`GET` retourne tout le tableau).
- Il n'y a que 4 rôles : `pilgrim`, `agency`, `guide`, `admin`. Le
  back-office web ne concerne que `agency` et `admin`.

## Auth (`/auth`) — agence / admin

| Méthode | Route | Public | Body | Réponse |
|---|---|---|---|---|
| POST | `/auth/agency/login` | oui | `{ email, password (min 8) }` | `AuthTokensDto` |
| POST | `/auth/refresh` | oui | `{ refreshToken }` | `AuthTokensDto` |
| POST | `/auth/logout` | non | `{ refreshToken }` | 204 |

`AuthTokensDto = { accessToken: string, refreshToken: string }`.

- **Il n'existe aucune route d'inscription admin** — un compte admin est
  provisionné directement en base par un opérateur technique (voir
  `docs/auth-setup.md` dans le dépôt backend), jamais via l'API publique.
  Le web n'a donc pas de formulaire "créer un compte admin" à prévoir.
- Une agence se crée via `POST /agencies/register` (ci-dessous), qui crée
  à la fois le compte utilisateur (rôle `agency`) et la fiche agence — pas
  de `/auth/agency/register` séparé.
- Pas de "mot de passe oublié" implémenté.

## Agences (`/agencies`)

`AgencyShape` (`src/types/agency.types.ts`) — **module migré sur Prisma,
`id`/`ownerId`/`validatedById` sont des UUID strings** :
```ts
{
  id: string; legalName: string; ownerId: string; contactEmail: string;
  contactPhone: string; address?: string;
  legalDocuments: { label: string; storageRef: string; uploadedAt: Date }[];
  validationStatus: 'pending'|'approved'|'rejected';
  rejectionReason?: string; validatedById?: string; validatedAt?: Date;
  commissionRate: number;
  bankDetails?: { accountName: string; accountNumber: string; bankName: string };
}
```

| Méthode | Route | Rôle | Body/Query | Réponse |
|---|---|---|---|---|
| POST | `/agencies/register` | public | `{ legalName, contactEmail, contactPhone, password (min 8), address? }` | Agency `validationStatus: pending` |
| GET | `/agencies/me` | agency | — | Agency de l'agence connectée |
| PATCH | `/agencies/me` | agency | `{ address?, bankDetails? }` | Agency mise à jour |
| GET | `/agencies` | admin | `?status=pending\|approved\|rejected` | Agency[] |
| GET | `/agencies/:id` | admin | — | Agency |
| PATCH | `/agencies/:id/approve` | admin | — | Agency `validationStatus: approved` |
| PATCH | `/agencies/:id/reject` | admin | `{ reason (min 3) }` | Agency `validationStatus: rejected` |

- **Une agence ne peut publier aucun forfait tant qu'elle n'est pas
  `approved`** (409 sinon) — le flux attendu côté UI : inscription →
  écran d'attente → l'admin valide → l'agence peut créer des forfaits.
  Prévoir un état "en attente de validation" clairement affiché.
- `legalDocuments` existe dans le modèle de données mais **aucun endpoint
  n'alimente ce tableau aujourd'hui** — impossible d'uploader une pièce
  justificative via cette API pour l'instant ; il sera toujours vide en
  pratique. Ne pas construire d'écran "upload documents légaux" côté
  agence tant que ce n'est pas ajouté côté backend.
- `commissionRate` est en lecture pour l'agence (pas de champ pour le
  modifier soi-même) — c'est un paramètre admin, mais **il n'y a
  actuellement aucun endpoint permettant à l'admin de le modifier non
  plus**. Champ présent en base, pas encore exposé en écriture.

## Utilisateurs — vue admin (`/users`)

`UserShape` (`src/types/user.types.ts`) :
```ts
{
  id: string; fullName: string; phone?: string; email?: string;
  role: 'pilgrim'|'agency'|'guide'|'admin'; preferredLanguage: string;
  emergencyContact?: {...}; bloodType?: string; passportNumber?: string;
  agencyId?: string; isActive: boolean; createdAt: Date; updatedAt: Date;
}
```

| Méthode | Route | Rôle | Query | Réponse |
|---|---|---|---|---|
| GET | `/users` | admin | `?role=pilgrim\|agency\|guide\|admin&agencyId=<uuid>` | UserShape[] |
| PATCH | `/users/:id/suspend` | admin | — | UserShape `isActive: false` |
| PATCH | `/users/:id/reactivate` | admin | — | UserShape `isActive: true` |

- `role` est **obligatoire** sur `GET /users` (pas de listing "tous rôles
  confondus" en un seul appel) — l'UI admin devra faire un appel par onglet
  de rôle, ou plusieurs appels en parallèle.
- **Un guide se crée comment ?** Il n'y a aucun endpoint `POST /users` ni
  `POST /guides` — la création d'un compte guide n'est exposée nulle part
  dans cette API actuellement. À clarifier avec le backend avant de
  construire un écran "ajouter un guide" côté agence — ce flux n'existe
  pas encore.
- Suspendre un compte (`isActive: false`) bloque l'auth (401 "Compte
  suspendu") sur OTP, login et refresh token — vérifié dans le code auth.

## Forfaits (`/packages`) — gestion agence

`PackageShape` (`src/types/package.types.ts`) — **module migré sur
Prisma** :
```ts
{
  id: string; agencyId: string; type: 'oumra'|'hadj'; title: string;
  description?: string; startDate: Date; endDate: Date; price: number;
  currency: string; capacity: number; seatsTaken: number;
  hotel?: { name: string; city: string; distanceToMosqueMeters?: number };
  inclusions: string[]; status: 'open'|'full'|'closed';
}
```

| Méthode | Route | Rôle | Body | Réponse |
|---|---|---|---|---|
| GET | `/packages/mine` | agency | — | PackageShape[] de l'agence connectée |
| POST | `/packages` | agency | `{ type, title, startDate, endDate, price, capacity, description?, currency?, hotel?, inclusions? }` (dates en `IsDateString`) | PackageShape (409 si agence non `approved`) |
| PATCH | `/packages/:id` | agency | sous-ensemble du body de création | PackageShape |
| PATCH | `/packages/:id/close` | agency | — | PackageShape `status: closed` |

- `seatsTaken`/`status` (`open`→`full`) sont **gérés automatiquement** par
  le module `bookings` à chaque réservation/annulation — ne jamais les
  envoyer en écriture depuis le formulaire de création/édition (ils sont
  ignorés côté DTO de toute façon, `CreatePackageDto`/`UpdatePackageDto`
  ne les exposent pas).
- Pas de route `GET /packages/:id` réservée agence pour voir un forfait
  qui ne serait pas public — seule la route publique existe
  (`GET /packages/:id`, cf. doc mobile), utilisable aussi côté web.

## Groupes (`/groups`) — gestion agence

`GroupShape` (`src/types/group.types.ts`) — **module migré sur Prisma** :
```ts
{
  id: string; packageId: string; agencyId: string; title: string;
  guideId?: string; memberIds: string[];
  itinerary: { label: string; date: Date; location?: string }[];
  locations: { userId: string; fullName: string; lat: number; lng: number; updatedAt: Date }[];
}
```

| Méthode | Route | Rôle | Body | Réponse |
|---|---|---|---|---|
| POST | `/groups` | agency | `{ packageId (UUID), title }` | Group |
| GET | `/groups/mine` | agency | — | Group[] de l'agence |
| GET | `/groups/:id` | agency (propriétaire) | — | Group |
| PATCH | `/groups/:id/guide` | agency | `{ guideUserId (UUID) }` | Group (400 si l'utilisateur désigné n'a pas le rôle `guide`) |
| POST | `/groups/:id/itinerary` | agency | `{ label, date (ISO), location? }` | Group (étape ajoutée à la fin, pas de suppression/réordonnancement possible) |

- Ajouter un pèlerin à un groupe **ne se fait pas via `/groups`** mais via
  `PATCH /bookings/:id/group` avec `{ groupId }` côté réservation (voir
  section Bookings) — c'est `BookingsService` qui appelle en interne
  `GroupsService.addMember`. Il n'y a pas de `POST /groups/:id/members`
  direct.
- Pas d'endpoint pour retirer un membre ou changer/supprimer une étape
  d'itinéraire une fois ajoutée.
- Position (`locations`) : lecture uniquement via `GET /groups/:id` — pas
  de vue "carte temps réel" avec historique, une seule position par membre
  (upsert).

## Réservations (`/bookings`) — vue agence

⚠️ Module **pas encore migré** vers Prisma — réponse réelle actuelle en
forme Mongo (`_id` au lieu de `id`). Forme cible (`BookingShape`) :
```ts
{
  id: string; pilgrimId: string; packageId: string; agencyId: string;
  groupId?: string; status: 'pending_payment'|'confirmed'|'cancelled'|'completed';
  steps: { key: 'payment'|'visa'|'flight'|'vaccination'|'documents';
           status: 'pending'|'in_progress'|'done'; updatedAt: Date }[];
}
```

| Méthode | Route | Rôle | Body | Réponse |
|---|---|---|---|---|
| GET | `/bookings/agency` | agency | — | Booking[] de l'agence connectée |
| GET | `/bookings/:id` | agency (propriétaire) | — | Booking |
| PATCH | `/bookings/:id/step` | agency | `{ key, status }` | Booking (passe `confirmed` automatiquement si les 5 étapes sont `done`) |
| PATCH | `/bookings/:id/group` | agency | `{ groupId (UUID) }` | Booking assigné à un groupe existant |

- L'étape `payment` ne devrait normalement **pas** être basculée à `done`
  manuellement par l'agence via `PATCH .../step` — elle est soldée
  automatiquement par le module `payments` quand le cumul payé atteint le
  prix du forfait. Le DTO ne l'empêche pas techniquement, mais ce n'est
  pas le flux prévu.

## Paiements (`/payments`) — supervision agence

⚠️ Module pas migré — forme Mongo actuelle. Forme cible (`PaymentShape`) :
```ts
{
  id: string; bookingId: string; amount: number; currency: string;
  installmentNumber: number; method: 'mobile_money_orange'|'mobile_money_mtn'|'card';
  status: 'pending'|'succeeded'|'failed'; providerReference: string;
  receiptRef?: string; confirmedAt?: Date;
}
```

| Méthode | Route | Rôle | Réponse |
|---|---|---|---|
| GET | `/payments/agency` | agency | Payment[] de toutes les réservations de l'agence |
| GET | `/payments/:id` | agency (propriétaire) / admin | Payment |

- **Aucun agrégateur Mobile Money/carte réel n'est branché** (ADR 0006) —
  l'agence ne peut pas "forcer" un paiement en succès depuis le web ; la
  confirmation ne vient que du webhook `POST /payments/webhook` (public,
  appelé par un vrai prestataire, inexistant aujourd'hui). En dev/démo,
  simuler ce webhook manuellement est le seul moyen de faire progresser un
  paiement en `succeeded`.
- Pas de génération de reçu PDF téléchargeable — `receiptRef` n'est qu'une
  référence texte (`RCPT-<id>`), pas un fichier.

## Documents (`/documents`) — validation agence

⚠️ Module pas migré — forme Mongo actuelle. Forme cible
(`PilgrimDocumentShape`) :
```ts
{
  id: string; bookingId: string; pilgrimId: string;
  type: 'passport'|'visa'|'flight_ticket'|'vaccination_certificate';
  storageRef: string; status: 'pending'|'validated'|'rejected';
  rejectionReason?: string;
}
```

| Méthode | Route | Rôle | Body | Réponse |
|---|---|---|---|---|
| GET | `/documents?bookingId=<id>` | agency (de la réservation) / pilgrim (le sien) | — | Document[] |
| PATCH | `/documents/:id/validate` | agency | — | Document `status: validated` |
| PATCH | `/documents/:id/reject` | agency | `{ reason (min 3) }` | Document `status: rejected` |

- **Le back-office web ne peut pas afficher le fichier directement** —
  `storageRef` est une référence vers un stockage objet externe (ADR 0008)
  dont le mécanisme d'accès (URL signée ou autre) n'est pas encore
  implémenté côté backend. À clarifier avant de construire la visionneuse
  de documents.

## Contenu des rites (`/rites`) — administration

`RiteSheetShape` (forme cible) :
```ts
{
  id: string; key: string; title: string; pilgrimageType: 'oumra'|'hadj'|'both';
  order: number; content: string; audioRef?: string; language: string;
  version: number; isValidated: boolean; validatedById?: string; validatedAt?: Date;
}
```

| Méthode | Route | Rôle | Body | Réponse |
|---|---|---|---|---|
| GET | `/rites/sheets/admin` | admin | — | RiteSheetShape[] (toutes, validées ou non) |
| POST | `/rites/sheets` | admin | `{ key, title, pilgrimageType, order, content (min 10 car.), audioRef?, language? ('fr'\|'en'\|'ar') }` | Fiche créée `isValidated: false` |
| PATCH | `/rites/sheets/:id` | admin | sous-ensemble du body de création | Fiche mise à jour, **`isValidated` remis à `false` automatiquement** et version incrémentée |
| PATCH | `/rites/sheets/:id/validate` | admin | — | Fiche `isValidated: true` |

- ⚠️ **Contenu religieux** : toute fiche créée/modifiée doit être signalée
  comme "à valider par une personne qualifiée" tant qu'elle n'est pas
  passée par `PATCH .../validate` (voir CLAUDE.md du dépôt backend) —
  l'écran admin doit rendre ce statut très visible et ne jamais laisser
  penser qu'une fiche non validée est publiée (elle n'apparaît d'ailleurs
  pas sur `GET /rites/sheets`, la route publique, tant qu'elle n'est pas
  validée).
- Toute modification invalide automatiquement la validation précédente —
  prévoir ce comportement dans le workflow (une fiche déjà publiée qui est
  éditée redevient invisible du public jusqu'à re-validation).

## Avis (`/reviews`) — lecture publique

| Méthode | Route | Public | Réponse |
|---|---|---|---|
| GET | `/reviews/agency/:agencyId` | oui | Review[] publics de l'agence |

- Pas d'endpoint de modération/suppression d'avis côté agence ou admin —
  un avis, une fois posté, reste visible tel quel.

## Statistiques admin (`/admin/stats`)

| Méthode | Route | Rôle | Réponse (`PlatformStatsDto`) |
|---|---|---|---|
| GET | `/admin/stats` | admin | `{ totalPilgrims, totalGuides, agenciesByStatus: Record<string,number>, bookingsByStatus: Record<string,number>, totalRevenue }` |

- C'est le **seul** endpoint du module `admin` — pas de détail par agence,
  pas de série temporelle, pas d'export. `totalRevenue` = somme des
  paiements `succeeded` uniquement, toutes agences confondues.

## Numéros d'urgence (`/emergency`) — idée #21

| Méthode | Route | Rôle | Corps / réponse |
|---|---|---|---|
| GET | `/emergency/numbers` | public | `EmergencyNumberShape[]` (ordre `order`, puis libellé) |
| POST | `/emergency/numbers` | admin | `label`, `category` (`police`, `medical`, `civil_defense`, `embassy`, `other`), `phone`, `country` (ISO alpha-2), `city?`, `notes?`, `order?` |
| PATCH / DELETE | `/emergency/numbers/:id` | admin | mise à jour partielle / 204 |
| GET | `/emergency/contacts/mine` | pèlerin, guide | `{ agencies[], guides[] }` déduits des réservations actives et des groupes |

Aucun numéro n'est pré-rempli : l'administration saisit des numéros vérifiés.

## Annuaire public des agences (`/directory/agencies`) — idée #71

`GET /directory/agencies` (public) : agences **approuvées**, triées par nom —
`id`, `legalName`, `address?`, `validatedAt?`, `trustScore`
(`AgencyTrustScoreShape`). Volet plateforme seulement : le registre national
de l'État relève de l'ADR 0015 (proposé).

## Besoins spéciaux (`/users/me/special-needs`) — idée #69

`GET` / `PUT` (pèlerin) : `mobility` (`none` | `reduced` | `wheelchair`),
`dietary?`, `medical?`, `assistance?` (500 caractères max). `PUT` remplace la
déclaration : un champ absent ou vide est effacé. Données de santé : jamais
journalisées, jamais visibles de l'administration.

## Liste de groupe (`/groups/:id/roster`) — idée #41

`GET /groups/:id/roster` (agence propriétaire, guide du groupe) :
`GroupRosterShape` — membres triés par nom avec téléphone, e-mail,
réservation et statut, contact d'urgence, besoins spéciaux. Jamais de
passeport ni de groupe sanguin. `GET /groups/:id/roster/csv` : même contenu en
CSV (UTF-8 avec BOM, `Content-Disposition: attachment`). Chaque consultation
est journalisée (qui, quel groupe), jamais son contenu.

## Export comptable (`/payments/agency/accounting`) — idée #57

`GET /payments/agency/accounting?from=AAAA-MM-JJ&to=AAAA-MM-JJ` (agence) :
`AccountingExportShape` — `from`, `to` (bornes incluses ; défaut : mois en
cours jusqu'à aujourd'hui, 366 jours au plus), `currency`,
`totalCollected`, `totalRefunded`, `net`, `entries[]` (une écriture par
encaissement `ENC` — débit — et par remboursement `REM` — crédit — de la
période : `date`, `pieceRef`, `label`, `debit`, `credit`, `method`,
`providerReference`, `bookingId`, `installmentNumber`, `pilgrimName`,
`packageTitle`). `GET …/accounting/csv` : même journal pour Excel FR / Sage
(BOM, `;`, dates JJ/MM/AAAA, virgule décimale). Chaque export est
journalisé (agence, période, nombre d'écritures).

## Allotement des chambres (`/rooms`) — idée #40

Agence : `GET /rooms/blocks?packageId=`, `POST /rooms/blocks`
(`packageId`, `stageId?` — hôtel et ville repris de l'étape —, `hotelName?`,
`city?`, `roomType` `double`…`quintuple`, `roomCount` 1–500,
`releaseDate?`, `notes?`), `GET|PATCH|DELETE /rooms/blocks/:id` (pas de
réduction sous une chambre occupée, pas de suppression d'un bloc occupé).
`RoomBlockShape` : capacité (`bedsPerRoom`, `totalBeds`, `assignedBeds`),
`rooms[]` numérotées avec leurs occupants, `unassigned[]` (réservations
actives du forfait sans place dans ce bloc).
`PUT /rooms/blocks/:id/assignments` (`bookingId`, `roomNumber?` — absent :
première chambre libre) place ou déplace ; `DELETE
/rooms/blocks/:id/assignments/:bookingId` libère.
`GET /rooms/blocks/:id/rooming-list/csv` : rooming list pour l'hôtel.
Pèlerin : `GET /rooms/mine` (hôtel, ville, type, numéro de chambre, dates).

## Médiation des litiges (`/disputes`) — idée #62

Pèlerin : `POST /disputes` (`bookingId`, `category` — `payment`, `refund`,
`accommodation`, `transport`, `documents`, `service`, `other` —, `subject`
5–140, `message` 10–2000) ; un seul litige en cours par réservation.
`GET /disputes?status=` : pèlerin → les siens, agence → ceux de son agence,
admin → seulement `escalated` et `closed`. `GET /disputes/:id` : détail avec
`messages[]` (consultation journalisée). `POST /disputes/:id/messages`
(`content`) : l'agence qui répond passe le litige en `agency_responded`, le
pèlerin qui relance le repasse en `open`. Pèlerin : `POST …/resolve`
(clos à l'amiable, `resolved`), `POST …/escalate` (après une réponse de
l'agence, ou 7 jours sans réponse — `escalationAvailableAt`). Admin :
`POST …/decision` (`decision` 10–2000) sur un litige escaladé → `closed`.
Litiges clos purgés après 24 mois.

## Barème de remboursement (`/refund-policies`) — idée #58

Agence : `GET /refund-policies/mine`, `PUT /refund-policies/mine`
(`tiers[]` de `{ minDaysBeforeDeparture` 0–730, `rate` 0–1 `}`, 10 au plus,
seuils distincts, taux qui ne remonte pas à l'approche du départ ; liste
vide = barème par défaut). Public : `GET /refund-policies/agency/:agencyId`.
Le barème est figé sur chaque réservation à sa création. Règle :
non confirmée 100 %, annulée/terminée 0 %, confirmée → palier atteint le
plus élevé (0 % sous le dernier), 50 % sans barème.
`GET /payments/:id/refund-preview` (pèlerin, agence, admin) :
`eligibleRate`, `refundableAmount`, `rule` (`unpaid_booking`,
`agency_tier`, `platform_default`, `not_refundable`),
`daysBeforeDeparture`, `tiers`.

## Facture et contrat (`/bookings/:id/invoice`, `/contract`) — idée #37

Pèlerin concerné, agence de la réservation, admin. `GET …/invoice` émet la
facture à la première demande (`FAC-AAAA-NNNNN`, séquence par agence et
par année, montant figé) puis la relit : vendeur (NIF `taxId`, RCCM
`tradeRegister` — renseignés par `PATCH /agencies/me`), acheteur, forfait,
versements, `paid`, `refunded`, `balanceDue`. `GET …/contract` : parties,
forfait (étapes, inclusions), prix, `balanceDueDate`, `refundTiers` figés.

## Planning des guides (`/guide-planning`) — idée #42

Agence : `GET /guide-planning?from&to` (défaut aujourd'hui → un an) — par
guide, `entries[]` (`group` aux dates du forfait, `unavailability`) et
`conflicts[]` (paires qui se chevauchent, jours communs).
`POST /guide-planning/unavailabilities` (`guideId`, `startDate`, `endDate`,
`reason?` 80 car.), `DELETE /guide-planning/unavailabilities/:id`. Guide :
`GET /guide-planning/mine`. `PATCH /groups/:id/guide` répond désormais
409 si le guide mène déjà un groupe ou est indisponible sur ces dates.

## Piste d'audit (`/admin/audit`) — idée #85

Admin : `GET /admin/audit?from&to&action&entityType&entityId&actorId`
(30 derniers jours par défaut, 366 jours au plus, 500 entrées) et
`GET /admin/audit/csv` (10 000 entrées, export lui-même tracé).
`AuditLogShape` : `action` (`agency.approve`, `payment.refund`,
`dispute.decide`…), `entityType`, `entityId`, auteur (`actorId`,
`actorName`, `actorRole`), `metadata` (références et montants seulement),
`createdAt`. Aucune route de modification ni de suppression.
## Astreinte 24/7 (`/on-call`) — idée #63

Agence : `GET /on-call/shifts?packageId=&from=&to=` (créneaux qui se
terminent après `from`, défaut maintenant ; avec `packageId`, ceux du
forfait et ceux valables pour tous les voyages), `POST /on-call/shifts`
(`packageId?` — absent : tous les voyages —, `staffName`, `staffRole`
`guide` | `coordinator` | `manager` | `other`, `phone` au format
international, `startsAt`, `endsAt` — après le début, 14 jours au plus —,
`notes?` interne), `PATCH|DELETE /on-call/shifts/:id` (le forfait ne change
pas). `GET /on-call/coverage/:packageId` : `OnCallCoverageShape` —
`from`/`to` (premier jour → minuit du dernier jour), `totalHours`,
`coveredHours`, `gaps[]` (périodes sans personne d'astreinte).
Pèlerin : `GET /on-call/booking/:bookingId` → `MyOnCallShape` (`current[]`
joignables maintenant, `next?`, `agencyPhone` en dernier recours ; jamais les
notes internes).

## Simulateur de capacité (`/capacity/simulation`) — idée #68

`GET /capacity/simulation?pilgrimsPerGuide=40&extraGuides=0` (agence) :
`CapacitySimulationShape` — `guides` (guides actifs de l'agence), `staff`
(+ `extraGuides` hypothétiques), `trips[]` (voyages non terminés :
`capacity`, `seatsTaken`, `guidesNeeded` au ratio, `guidesAssigned` aux
groupes), `periods[]` (périodes où le même ensemble de voyages est en
cours : pèlerins prévus/vendus, guides nécessaires — un guide n'encadre
qu'un voyage à la fois), `peak?`, `spareGuidesAtPeak` (négatif : il en
manque), `extraPilgrimsAtPeak`. Le ratio (5–200, défaut 40) est un repère
de l'agence, pas une norme réglementaire ; rien n'est enregistré.

## Simulateur de rentabilité (`/profitability/simulation`) — idée #48

`POST /profitability/simulation` (agence, réponse 200, rien n'est
enregistré) : `packageId?` (prix, devise, capacité et places vendues repris
du forfait), `price?`/`capacity?` (requis sans forfait, ou pour tester une
autre valeur), `currency?`, `expectedPilgrims?` (défaut : capacité),
`costsPerPilgrim[]` et `fixedCosts[]` (`label`, `amount` ≥ 0, 30 lignes au
plus). `ProfitabilitySimulationShape` : `commissionRate` (fraction, lue en
base — jamais fournie par le client), `unitContribution`,
`breakEvenPilgrims?`, `breakEvenReachable`, `minimumPrice?` (prix sans
perte au remplissage attendu), `scenarios[]` (`expected`, `sold` avec un
forfait, `half`, `three_quarters`, `full` : chiffre d'affaires, commission,
coûts, marge, `marginRate`, `marginPerPilgrim`).

## Programme de fidélité (`/loyalty`) — idée #47

Agence : `GET|PUT /loyalty/program/mine` (`tiers[]` de `{ minTrips` 1–50,
`label` 2–40, `benefit` 2–200 `}`, 5 au plus, seuils distincts ; liste
vide = pas de programme). L'avantage est accordé par l'agence elle-même :
**aucune remise automatique** sur les paiements. `GET /loyalty/members` :
pèlerins ayant voyagé avec l'agence (`pilgrimName`, `trips`,
`lastTripEnd`, `tier?`), du plus fidèle au moins fidèle — ni téléphone ni
document. Voyage effectué : réservation `completed`, ou `confirmed` dont le
forfait est revenu. Public : `GET /loyalty/program/agency/:agencyId`.
Pèlerin : `GET /loyalty/mine` → par agence, `trips`, `tier?`, `nextTier?`
(`tripsToGo`).

## Devis groupes et entreprises (`/quotes`) — idée #49

Agence : `GET /quotes?status=`, `POST /quotes` (`packageId?` — devise
reprise —, `clientName`, `clientType` `company` | `mosque` |
`association` | `other`, `contactName`, `contactPhone?`, `contactEmail?`,
`pilgrimsCount`, `lines[]` 1–30 de `{ label, quantity, unitPrice }`,
`discountRate?` 0–0,5, `conditions?`, `validUntil` à venir, un an au plus).
Numéro `DEV-AAAA-NNNNN` sans trou par agence et par année ; **totaux
toujours recalculés par le serveur** (un `totalAmount` envoyé est refusé).
`GET|PATCH|DELETE /quotes/:id` (modification et suppression en brouillon
seulement, 409 sinon). `POST /quotes/:id/send` : fige le devis et renvoie
`shareToken` pour le lien client. Public, sans compte :
`GET /quotes/shared/:token` (`SharedQuoteShape` : émetteur, lignes,
totaux, conditions, validité, `expired` — ni contacts saisis, ni jeton),
`POST /quotes/shared/:token/accept|decline` (une seule réponse, tant que le
devis est valable ; l'agence est notifiée sans montant). Envoi et réponses
tracés dans l'audit, jamais le jeton.

## Comparatif inter-saisons (`/seasons/comparison`) — idée #65

`GET /seasons/comparison?fromYear=&toYear=` (agence ; défaut : les trois
dernières années, 10 au plus) : `seasons[]` par année de départ et type
(`oumra` | `hadj`) — `packages`, `capacity`, `bookings` (non annulées),
`cancellations`, `fillRate`, `cancellationRate`, `averagePrice[]` et
`collected[]` (net des remboursements) par devise, `reviews`,
`averageRating`, `disputes`. Lecture seule.

## Ce qui n'est PAS encore branché (ne pas construire l'UI en le supposant fonctionnel)

- **Upload de documents légaux d'agence** : champ `legalDocuments` existe
  en base mais aucun endpoint ne l'alimente.
- **Modification de `commissionRate`** : aucun endpoint d'écriture.
- **Création de compte guide** : aucun endpoint — à clarifier avec le
  backend.
- **Mobile Money / carte réels, SMS/OTP réel, push FCM** : aucun
  fournisseur branché (ADR 0006/0009) — webhook paiement et notifications
  sont des simulations/stockage in-app.
- **Visionneuse de documents pèlerins** : pas d'endpoint pour récupérer le
  fichier réel, seulement sa référence.
- **Génération de reçu PDF** : rien côté API (l'export comptable existe, voir plus haut).
- **Messagerie agence↔pèlerin** : aucune API, malgré la mention au cahier
  des charges.

## État de la migration backend (MongoDB → PostgreSQL/Prisma)

Migré (réponses en `id` UUID, stable) : `users`, `auth`, `agencies`,
`packages`, `groups`. **Pas encore migré** (réponses en `_id` Mongo pour
l'instant) : `bookings`, `payments`, `documents`, `rites`, `notifications`,
`reviews`. Ordre et détail : `docs/roadmap.md` dans ce dépôt backend.
Recommandation : traiter tout id comme une string opaque côté web (ne pas
valider son format), ce doc sera mis à jour à chaque étape de migration.
