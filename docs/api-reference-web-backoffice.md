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
  locations: { userId: string; lat: number; lng: number; updatedAt: Date }[];
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
- **Export compta / génération de reçu PDF** : rien côté API.
- **Messagerie agence↔pèlerin** : aucune API, malgré la mention au cahier
  des charges.

## État de la migration backend (MongoDB → PostgreSQL/Prisma)

Migré (réponses en `id` UUID, stable) : `users`, `auth`, `agencies`,
`packages`, `groups`. **Pas encore migré** (réponses en `_id` Mongo pour
l'instant) : `bookings`, `payments`, `documents`, `rites`, `notifications`,
`reviews`. Ordre et détail : `docs/roadmap.md` dans ce dépôt backend.
Recommandation : traiter tout id comme une string opaque côté web (ne pas
valider son format), ce doc sera mis à jour à chaque étape de migration.
