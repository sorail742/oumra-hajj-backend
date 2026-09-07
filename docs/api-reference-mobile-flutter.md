# Référence API — app mobile Flutter (pèlerin / guide)

Document de référence pour la fenêtre Claude travaillant sur le dépôt
**Flutter séparé**. Contenu vérifié directement dans le code du backend
(contrôleurs, DTO, `src/types/`) à la date ci-dessous — **pas** le cahier
des charges, qui décrit des fonctionnalités pas toutes implémentées.

Dernière vérification : 2026-09-07, backend `develop` — migration Prisma
terminée sur tous les modules (voir "État de la migration" en bas) : tous
les ids renvoyés par l'API sont désormais des UUID strings stables (`id`,
plus de `_id` Mongo nulle part).

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
- Codes : 400 (DTO/règle invalide), 401 (JWT/OTP invalide, compte suspendu),
  403 (pas propriétaire de la ressource), 404 (introuvable), 409 (conflit
  d'état : forfait complet, agence non validée, avis déjà posé).
- **Aucun endpoint de suppression n'existe** sur aucune ressource — pas de
  DELETE dans toute l'API actuelle.

## Auth (`/auth`)

| Méthode | Route | Public | Body | Réponse |
|---|---|---|---|---|
| POST | `/auth/otp/request` | oui | `{ phone }` (E.164, ex. `+224620000000`) | `{ sent: true }` |
| POST | `/auth/otp/verify` | oui | `{ phone, code (4-8 car.), fullName? }` | `AuthTokensDto` |
| POST | `/auth/refresh` | oui | `{ refreshToken }` | `AuthTokensDto` |
| POST | `/auth/logout` | non | `{ refreshToken }` | 204 |

`AuthTokensDto = { accessToken: string, refreshToken: string }`.

- Un pèlerin/guide **n'a pas de login email/mot de passe** — uniquement OTP
  par téléphone. Le compte est créé automatiquement au premier
  `otp/verify` réussi (rôle `pilgrim` par défaut ; un guide est créé côté
  admin, voir doc web).
- `fullName` sur `otp/verify` n'est utilisé que si c'est une première
  inscription (sinon ignoré).
- **Le vrai code OTP n'est jamais envoyé par SMS aujourd'hui** — voir
  section "Ce qui n'est pas encore branché" plus bas. En dev, il est
  seulement journalisé côté serveur (`ConsoleOtpSender`).
- Pas de logout "tous les appareils" — `logout` ne révoque que le refresh
  token fourni.

## Profil (`/users`)

`UserShape` (`src/types/user.types.ts`) :
```ts
{
  id: string; fullName: string; phone?: string; email?: string;
  role: 'pilgrim'|'agency'|'guide'|'admin'; preferredLanguage: string;
  emergencyContact?: { fullName: string; phone: string; relationship?: string };
  bloodType?: string; passportNumber?: string; agencyId?: string;
  isActive: boolean; createdAt: Date; updatedAt: Date;
}
```
`passwordHash` n'existe même pas dans cette forme — jamais exposé, pour
personne.

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| GET | `/users/me` | — | `UserShape` |
| PATCH | `/users/me` | `{ fullName?, preferredLanguage? ('fr'\|'en'\|'ar'), emergencyContact?, bloodType?, passportNumber? }` | `UserShape` |

## Catalogue forfaits (`/packages`)

`PackageShape` (`src/types/package.types.ts`) :
```ts
{
  id: string; agencyId: string; type: 'oumra'|'hadj'; title: string;
  description?: string; startDate: Date; endDate: Date; price: number;
  currency: string; capacity: number; seatsTaken: number;
  hotel?: { name: string; city: string; distanceToMosqueMeters?: number };
  inclusions: string[]; status: 'open'|'full'|'closed';
}
```

| Méthode | Route | Public | Query/Body | Réponse |
|---|---|---|---|---|
| GET | `/packages` | oui | `?type=oumra\|hadj&agencyId=<uuid>` | `PackageShape[]` (uniquement `status=open`) |
| GET | `/packages/:id` | oui | — | `PackageShape` |

Pas d'avis (rating) intégré directement dans `PackageShape` — les avis
sont consultés séparément via `/reviews/agency/:agencyId`.

## Réservations (`/bookings`)

`BookingShape` (`src/types/booking.types.ts`) :
```ts
{
  id: string; pilgrimId: string; packageId: string; agencyId: string;
  groupId?: string; status: 'pending_payment'|'confirmed'|'cancelled'|'completed';
  steps: { key: 'payment'|'visa'|'flight'|'vaccination'|'documents';
           status: 'pending'|'in_progress'|'done'; updatedAt: Date }[];
}
```

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| POST | `/bookings` | `{ packageId }` (UUID) | Booking créé, statut `pending_payment`, 5 étapes initialisées `pending` |
| GET | `/bookings/mine` | — | Booking[] du pèlerin connecté |
| GET | `/bookings/:id` | — | Booking (403 si pas le pèlerin/agence propriétaire ni admin) |
| PATCH | `/bookings/:id/cancel` | — | Booking annulé, libère la place sur le forfait |

- 409 si le forfait est complet/fermé au moment de la réservation.
- Le statut passe automatiquement à `confirmed` quand les 5 étapes sont
  `done` (dont l'étape `payment`, soldée automatiquement par le webhook de
  paiement — voir plus bas).
- Assignation à un groupe et mise à jour des étapes : réservé à l'agence
  (voir doc web), pas d'action pèlerin dessus.

## Paiements (`/payments`)

`PaymentShape` (`src/types/payment.types.ts`) :
```ts
{
  id: string; bookingId: string; amount: number; currency: string;
  installmentNumber: number; method: 'mobile_money_orange'|'mobile_money_mtn'|'card';
  status: 'pending'|'succeeded'|'failed'; providerReference: string;
  receiptRef?: string; confirmedAt?: Date;
}
```

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| POST | `/payments/initiate` | `{ bookingId, amount, method }` | Payment `status: pending`, `providerReference: "dev-<uuid>"` |
| GET | `/payments/mine` | — | Payment[] du pèlerin connecté |
| GET | `/payments/:id` | — | Payment (403 si pas autorisé) |

- **Aucun vrai prestataire Mobile Money/carte n'est branché** — `initiate`
  ne fait qu'enregistrer une tentative avec une référence factice. La
  confirmation réelle passe par un webhook serveur-à-serveur
  (`POST /payments/webhook`, public, appelé par le prestataire — pas par
  l'app mobile). L'app doit donc **poller** `GET /payments/:id` ou
  `GET /bookings/:id` pour voir le statut évoluer après paiement, il n'y a
  pas de notification push de confirmation de paiement fonctionnelle
  aujourd'hui (voir section notifications).
- Une réservation peut être payée en plusieurs tranches
  (`installmentNumber` s'incrémente automatiquement).

## Documents (coffre-fort) (`/documents`)

`PilgrimDocumentShape` (`src/types/document.types.ts`) :
```ts
{
  id: string; bookingId: string; pilgrimId: string;
  type: 'passport'|'visa'|'flight_ticket'|'vaccination_certificate';
  storageRef: string; status: 'pending'|'validated'|'rejected';
  rejectionReason?: string;
}
```

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| POST | `/documents` | `{ bookingId, type, storageRef }` | Document `status: pending` |
| GET | `/documents/mine` | — | Document[] du pèlerin |
| GET | `/documents?bookingId=<id>` | — | Document[] (pèlerin propriétaire ou agence de la réservation) |

- **L'upload du fichier lui-même ne passe PAS par cette API.** `storageRef`
  est une référence déjà obtenue d'un stockage objet externe (S3-like, voir
  ADR 0008) — l'app doit d'abord uploader le fichier ailleurs (mécanisme
  exact non encore défini/documenté côté infra) puis appeler `POST
  /documents` avec la référence obtenue. Ne jamais envoyer le contenu du
  fichier en base64 dans ce body.
- Validation/rejet réservés à l'agence (voir doc web).

## Guide des rites (`/rites`)

`RiteSheetShape` / `RiteProgressShape` (`src/types/rite.types.ts`) :
```ts
RiteSheetShape { id; key; title; pilgrimageType: 'oumra'|'hadj'|'both';
  order: number; content: string; audioRef?: string; language: string;
  version: number; isValidated: boolean; validatedById?: string; validatedAt?: Date; }
RiteProgressShape { id; pilgrimId; riteKey; completed: boolean;
  tawafCount: number; saiCount: number; clientUpdatedAt: Date; }
```

| Méthode | Route | Public | Query/Body | Réponse |
|---|---|---|---|---|
| GET | `/rites/sheets` | oui | `?pilgrimageType=&language=` | `RiteSheetShape[]` — **uniquement celles validées** (`isValidated: true`) |
| GET | `/rites/progress` | — | — | `RiteProgressShape[]` du pèlerin |
| POST | `/rites/progress/sync` | — | `{ items: [{ riteKey, completed?, tawafCount?, saiCount?, clientUpdatedAt }] }` | `RiteProgressShape[]` |
| PATCH | `/rites/progress/:riteKey/reset-counter` | — | — | `RiteProgressShape` (remet tawaf/sai à 0) |

- **`GET /rites/sheets` peut renvoyer un tableau vide aujourd'hui** —
  aucune fiche de rite réelle n'a encore été validée en base (contenu
  religieux, doit être relu par une personne qualifiée avant publication,
  voir CLAUDE.md/issue #17). Ne pas construire l'UI en supposant que du
  contenu existe déjà.
- Sync conçue "offline-first" (ADR 0007) : l'app envoie ses écritures
  locales par lot avec `clientUpdatedAt`, le serveur résout les conflits
  par horodatage le plus récent (dernier écrit gagne par `riteKey`).
- Pas de guide audio réel forcément présent (`audioRef` optionnel).

## Groupes — vue pèlerin/guide (`/groups`)

`GroupShape` (`src/types/group.types.ts`) :
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
| GET | `/groups/assigned` | guide | — | Groupes assignés à ce guide |
| GET | `/groups/joined` | pèlerin | — | Groupes dont ce pèlerin est membre |
| GET | `/groups/:id` | pèlerin/guide/agence/admin | — | Group (403 si pas membre/guide/agence propriétaire/admin) |
| PATCH | `/groups/:id/location` | pèlerin, guide | `{ lat, lng }` | Group à jour (position remplacée, pas d'historique) |
| POST | `/groups/:id/sos` | pèlerin | — | 204, déclenche l'alerte |

- Partage de position **opt-in** côté produit (cahier des charges §3.1) —
  mais rien côté API n'empêche l'appel si le pèlerin est membre : le
  consentement/l'activation du partage est **entièrement une
  responsabilité de l'app mobile** (pas de flag `locationSharingEnabled`
  côté serveur aujourd'hui).
- `locations` n'a qu'une entrée par membre (upsert par `userId`) — pas
  d'historique de trajet.
- SOS notifie le guide assigné (notification critique, voir plus bas) et
  envoie un SMS brut au contact d'urgence du pèlerin **si un contact
  d'urgence est renseigné dans le profil** (`UserShape.emergencyContact`) —
  sinon rien n'est envoyé côté famille, pas d'erreur non plus.

## Avis (`/reviews`)

`ReviewShape` (`src/types/review.types.ts`) :
```ts
{ id; pilgrimId; agencyId; bookingId; rating: 1-5; comment?: string; createdAt }
```

| Méthode | Route | Public | Body | Réponse |
|---|---|---|---|---|
| POST | `/reviews` | non | `{ bookingId, rating (1-5), comment? }` | Review |
| GET | `/reviews/mine` | non | — | Review[] du pèlerin |
| GET | `/reviews/agency/:agencyId` | oui | — | Review[] publics de l'agence |

- Un avis n'est possible que si la réservation est `confirmed` ou
  `completed`, et un seul avis par réservation (409 sinon).

## Notifications (`/notifications`)

`NotificationShape` (`src/types/notification.types.ts`) :
```ts
{ id; recipientId; type: 'booking_status'|'payment'|'document'|'rite_reminder'|
  'sos'|'group_message'|'moderation'|'other'; title; content;
  isCritical: boolean; readAt?: Date; createdAt }
```

| Méthode | Route | Query | Réponse |
|---|---|---|---|
| GET | `/notifications` | `?unreadOnly=true` | Notification[] |
| PATCH | `/notifications/:id/read` | — | Notification marquée lue |

- **Ce sont des notifications "in-app" (stockées en base), pas des push
  FCM réelles** — voir ci-dessous. L'app doit poller `GET /notifications`
  (pas de WebSocket/SSE non plus) pour se tenir à jour.

## Ce qui n'est PAS encore branché (ne pas construire l'UI en le supposant fonctionnel)

- **SMS/OTP réel** : aucun fournisseur SMS choisi (ADR 0006 `proposé`) — en
  dev le code OTP est seulement loggé serveur, jamais envoyé.
- **Push notifications FCM** : pas intégré (ADR 0009) — `/notifications`
  est un stockage in-app seulement, pas de push réel.
- **Mobile Money / carte réels** : aucun agrégateur branché — `/payments`
  simule, la confirmation passe par un webhook que seul un vrai
  prestataire appellerait en prod.
- **Contenu des rites réel** : `GET /rites/sheets` peut être vide.
- **Qibla, compteur hors-ligne natif, bibliothèque de Duas audio** :
  fonctionnalités décrites au cahier des charges §3.1 mais **entièrement
  côté app** — aucun endpoint serveur dédié n'existe pour ça (le compteur
  Tawaf/Sai a un backend via `/rites/progress`, mais la boussole Qibla et
  les Duas n'ont aucune API).
- **Chat pèlerin↔agence** : mentionné au cahier des charges, aucune API de
  messagerie n'existe dans ce backend.

## État de la migration backend (MongoDB → PostgreSQL/Prisma)

Terminée (ADR 0013) — tous les modules sont sur Prisma/PostgreSQL, tous les
ids renvoyés par l'API sont des UUID strings stables. Détail historique :
`docs/roadmap.md` dans ce dépôt backend.
