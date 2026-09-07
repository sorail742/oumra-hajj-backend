# Intégrations externes

Inventaire des dépendances à un service externe (existantes, en stub de
développement, ou seulement décidées sur le papier). Complète les ADR
correspondants plutôt que de les remplacer — en cas de divergence, l'ADR
fait foi.

## Vue d'ensemble

| Intégration | Statut | ADR | Variable(s) d'env. |
|---|---|---|---|
| PostgreSQL (Prisma) | Intégré — migration en cours module par module | [0013](docs/adr/0013-migration-postgresql-prisma.md) (accepté) | `DATABASE_URL` |
| MongoDB (Mongoose) | Intégré — legacy, en cours de retrait | [0004](docs/adr/0004-base-de-donnees-orm.md) (remplacé par 0013) | `MONGO_URI` |
| JWT (auth interne, pas de provider tiers) | Intégré | [0003](docs/adr/0003-strategie-authentification.md) (accepté) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| SMS/OTP (pèlerin, connexion) | **Stub dev** (`ConsoleOtpSender`) | [0003](docs/adr/0003-strategie-authentification.md) / [0006](docs/adr/0006-gestion-paiements.md) (proposé) | — (fournisseur non choisi) |
| Notifications push (FCM) | **Stub dev** (`ConsolePushSender`) | [0009](docs/adr/0009-notifications.md) (accepté) | — (clés FCM non intégrées) |
| SMS de secours (alertes critiques) | **Stub dev** (`ConsoleSmsSender`) | [0009](docs/adr/0009-notifications.md) (accepté) | — |
| Paiement Mobile Money / carte | **Non intégré** | [0006](docs/adr/0006-gestion-paiements.md) (proposé) | — |
| Stockage documents sensibles | **Non intégré** | [0008](docs/adr/0008-stockage-documents-sensibles.md) (accepté) | — |
| SonarQube (qualité, CI) | Configuré mais non bloquant | [0012](docs/adr/0012-ci-cd-environnements.md) (proposé) | `SONAR_HOST_URL`, `SONAR_TOKEN` (CI) |
| Hébergement staging/production | Non choisi | [0012](docs/adr/0012-ci-cd-environnements.md) (proposé) | — |

« Stub dev » = une implémentation de développement existe dans le code et
respecte l'interface attendue, mais journalise au lieu d'appeler un vrai
provider — **jamais** à utiliser en production (voir `CLAUDE.md`).

## Détail

### Base de données — PostgreSQL/Prisma et MongoDB/Mongoose

Les deux coexistent pendant la migration ([ADR 0013](docs/adr/0013-migration-postgresql-prisma.md)) :
modules déjà migrés (`users`, `auth`, `agencies`, `packages`, `groups`)
utilisent `PrismaService` ; les modules restants (`bookings` en cours,
`payments`, `documents`, `rites`, `notifications`, `reviews`, `admin`)
utilisent encore `Model<T>` Mongoose. Voir `docs/roadmap.md` pour l'ordre et
l'avancement, `docs/devops.md` pour l'impact CI (les deux services de base
de données tournent en parallèle tant que la migration n'est pas terminée).

### SMS/OTP — connexion pèlerin/guide

Interface : `OtpSender` (`src/modules/auth/otp/otp-sender.interface.ts`).
Implémentation actuelle : `ConsoleOtpSender`, journalise le code au lieu de
l'envoyer par SMS (voir `docs/auth-setup.md` pour tester le flux en local).
Fournisseur réel non choisi — voir issue #18 (`docs/roadmap.md`), ADR 0006
non tranché. Mutualisation envisagée avec le provider SMS de secours des
notifications (même limitation de fournisseur, voir ADR 0009).

### Notifications push — Firebase Cloud Messaging

Interface : `PushSender` (`src/modules/notifications/senders/push-sender.interface.ts`).
Implémentation actuelle : `ConsolePushSender` (stub dev). FCM est retenu en
principe par [ADR 0009](docs/adr/0009-notifications.md) (accepté), mais
aucune clé/compte Firebase n'est encore intégré — voir issue #18.

### SMS de secours — alertes critiques

Interface : `SmsSender` (`src/modules/notifications/senders/sms-sender.interface.ts`).
Implémentation actuelle : `ConsoleSmsSender` (stub dev). Déclenché par
`NotificationsService.dispatch()` seulement si une notification marquée
`isCritical` n'est pas confirmée délivrée par le push, et utilisé
directement par le bouton SOS via `sendRawSms()` pour un contact d'urgence
qui n'est pas un utilisateur de la plateforme (voir cahier des charges
§3.1). Fournisseur non choisi (issue #18) — idem SMS/OTP, mutualisation
envisagée pour limiter le nombre d'intégrations tierces (ADR 0009).

### Paiement — Mobile Money & carte bancaire

Aucune implémentation, même en stub : le module `payments` expose déjà le
point d'entrée serveur-à-serveur (`POST /api/v1/payments/webhook`,
`PaymentWebhookDto`) qui met à jour un paiement existant par
`providerReference`, mais aucun agrégateur (Orange Money, MTN Money,
passerelle carte) n'est branché. En développement/tests, les références de
transaction sont générées côté serveur (`dev-<uuid>`) — voir
[ADR 0006](docs/adr/0006-gestion-paiements.md) (proposé) et `docs/testing.md`
("ne jamais générer de fausses données de paiement réalistes", voir
`CLAUDE.md`). Choix du/des agrégateurs : issue #18.

### Stockage de documents sensibles

Aucune implémentation : `DocumentsService` ne manipule qu'une **référence**
de stockage (`storageRef`, fournie par le client dans `UploadDocumentDto`) —
l'API ne téléverse rien elle-même et ne connaît pas le contenu du fichier.
Le provider de stockage objet (Firebase Storage ou équivalent compatible
S3, chiffrement au repos, URLs signées à courte durée de vie) reste à
choisir et intégrer avant que l'upload réel ne soit possible de bout en
bout — voir [ADR 0008](docs/adr/0008-stockage-documents-sensibles.md)
(accepté sur le principe, provider non choisi) et `docs/roadmap.md`
(bloquant pour la Phase 3, app mobile pèlerin).

### SonarQube

Job `sonarqube-check` déjà dans `.gitlab-ci.yml`, non bloquant tant que
`SONAR_HOST_URL`/`SONAR_TOKEN` ne sont pas renseignés dans les variables
CI/CD GitLab — voir `docs/devops.md`, issue #16.

## Ajouter une intégration réelle

1. Le choix du fournisseur (paiement, SMS/OTP, push, stockage) passe par un
   ADR — proposer un ADR dédié ou faire passer l'ADR existant de `proposé` à
   `accepté` une fois le partenaire retenu (voir `CONTRIBUTING.md`).
2. Implémenter l'interface existante (`OtpSender`, `PushSender`,
   `SmsSender`) dans une nouvelle classe (ex.
   `firebase-push-sender.service.ts`), jamais en modifiant le stub dev en
   place — le stub reste disponible pour les tests et le développement local
   sans compte réel.
3. Brancher la nouvelle implémentation via le token d'injection existant
   (`PUSH_SENDER`, `SMS_SENDER`, etc.) dans le module concerné, en la
   sélectionnant par variable d'environnement si dev et prod doivent
   coexister.
4. Toute clé/secret associé passe uniquement par variable d'environnement,
   jamais commité — voir `docs/secrets-management.md`.
5. Aucune donnée envoyée à un fournisseur externe (numéro de téléphone,
   contenu de document, donnée de paiement) ne doit apparaître dans un log —
   voir `CLAUDE.md`.
6. Le paiement, les documents sensibles et le bouton SOS nécessitent un test
   avant merge, y compris pour l'intégration réelle du provider (voir
   [ADR 0010](docs/adr/0010-strategie-tests.md), `CLAUDE.md`).

## Points ouverts

Voir `docs/roadmap.md` :

- **Issue #18** — choisir les fournisseurs SMS/OTP, paiement Mobile Money et
  FCM (ADR 0006 non tranché).
- **Issue #16** — confirmer l'ADR 0012, provisionner SonarQube, choisir
  l'hébergeur (conditionne aussi le provider de stockage documents, à
  choisir avant la Phase 3).
