# Wiki — Plateforme Oumra & Hadj

Page d'entrée pour comprendre le projet **sans** avoir à lire d'abord tout
`docs/`. Le `README.md` est le guide technique (installation, commandes) ;
ce document donne le contexte fonctionnel et sert de sommaire vers le reste.

## Le projet en une phrase

Accompagner chaque pèlerin, du premier paiement jusqu'au retour à la
maison : une app mobile (pèlerin/guide) et un back-office web
(agence/admin) consommant une même API centrale, pour digitaliser la
gestion de la Oumra et du Hadj — aujourd'hui centrée sur des agences en
Guinée / Afrique de l'Ouest qui fonctionnent encore au papier/WhatsApp. Voir
`docs/cahier-de-charge/readme.md` pour le cahier des charges complet.

**Ce dépôt** ne couvre que le backend (API centrale) — voir
`docs/roadmap.md` pour situer où il s'arrête par rapport au mobile Flutter
et au back-office web (dépôts séparés, pas encore démarrés).

## Rôles de la plateforme

| Rôle | Description |
|---|---|
| **Pèlerin** | S'inscrit à une Oumra/un Hadj via une agence, suit son dossier, paie en tranches, se prépare, est guidé sur place. |
| **Agence / Organisateur** | Vend des forfaits, gère groupes, paiements et logistique (visa, hôtel, transport). |
| **Guide / Mutawif** | Encadre un groupe sur place : présence, sécurité, orientation, réception des alertes SOS. |
| **Administrateur plateforme** | Valide les agences, supervise les paiements, modère le contenu religieux, vue statistique globale. |

Dans le code, ces rôles sont `Role.PILGRIM` / `Role.AGENCY` / `Role.GUIDE` /
`Role.ADMIN` (`src/common/enums/role.enum.ts`) — voir `docs/auth-flow.md`
pour comment chacun s'authentifie.

## Lexique métier

Termes qui reviennent dans le code, les ADR et les issues — utile pour ne
pas confondre le vocabulaire religieux et le vocabulaire produit.

| Terme | Sens |
|---|---|
| **Oumra** | Pèlerinage mineur à La Mecque, possible toute l'année. |
| **Hadj** | Pèlerinage majeur, obligatoire une fois dans la vie pour tout musulman qui en a les moyens ; dates fixes, plus de logistique (Mina, Arafat, Muzdalifah). |
| **Ihram, Tawaf, Sa'i, Rami** | Rites du pèlerinage — état de sacralisation, tours autour de la Kaaba, marche entre Safa et Marwa, lapidation symbolique. Voir module `rites` (contenu non encore validé, voir plus bas). |
| **Mutawif** | Guide/accompagnateur de groupe sur place — voir rôle `guide`. |
| **Forfait (Package)** | Offre commerciale d'une agence : type (Oumra/Hadj), dates, prix, hôtel, capacité. Module `packages`. |
| **Dossier (Booking)** | Réservation d'un pèlerin sur un forfait, avec ses étapes de progression (`DossierStepKey` : `payment`, `visa`, `flight`, `vaccination`, `documents`). Module `bookings`. |
| **Tranche** | Paiement partiel d'un forfait — un dossier a plusieurs paiements (module `payments`), jamais un seul paiement total obligatoire. |
| **Coffre-fort documents** | Espace où le pèlerin dépose ses documents sensibles (passeport, visa, billet, certificat de vaccination) — module `documents`, voir [ADR 0008](docs/adr/0008-stockage-documents-sensibles.md). |
| **Groupe** | Ensemble de pèlerins d'un même forfait, assigné à un guide — module `groups`. |
| **SOS** | Bouton d'alerte d'urgence déclenché par un pèlerin, reçu par son guide et un contact famille — voir `docs/adr/0009-notifications.md` et `docs/coding-rules-backend.md` (test obligatoire avant merge). |
| **Nusuk** | Plateforme officielle saoudienne qui centralise permis/visas/hébergement — le produit se positionne en complément (préparation, suivi famille, guide des rites), pas en concurrence sur les démarches officielles. |

## État du projet

Résumé — voir `docs/roadmap.md` pour le détail à jour :

- Phase 2 (backend & données) **en cours**. Les 12 modules métier + `auth`
  sont implémentés et testés.
- Migration de MongoDB/Mongoose vers PostgreSQL/Prisma en cours, module par
  module ([ADR 0013](docs/adr/0013-migration-postgresql-prisma.md)) :
  `users`/`auth`, `agencies`, `packages`, `groups` migrés ; `bookings` en
  cours ; `payments`, `documents`, `rites`, `notifications`, `reviews`,
  `admin` restent à migrer.
- Fournisseurs SMS/OTP, paiement Mobile Money et FCM **non choisis** — voir
  `integrations.md`.
- Aucune fiche de rite réelle en base — contenu religieux à rédiger et faire
  valider par une personne qualifiée avant toute publication (voir
  `CLAUDE.md`, `CONTRIBUTING.md`).

## Où trouver quoi

| Besoin | Document |
|---|---|
| Installer et lancer le backend en local | `README.md` |
| Décisions d'architecture (pourquoi, pas juste quoi) | `docs/adr/README.md` (index de tous les ADR) |
| Comment le code est organisé au quotidien | `docs/architecture.md`, `docs/coding-rules-backend.md` |
| Flux d'authentification (OTP, agence, JWT) | `docs/auth-flow.md`, `docs/auth-setup.md` |
| Codes d'erreur et format de réponse | `docs/error-codes.md` |
| Stratégie et commandes de tests | `docs/testing.md` |
| Versionnement de l'API (`/api/v1`, quand créer un v2) | `docs/api-versioning.md` |
| Workflow Git, issues, Merge Requests | `docs/workflow.md`, `CONTRIBUTING.md` |
| CI/CD, environnements | `docs/devops.md` |
| Secrets et rotation en cas de fuite | `docs/secrets-management.md` |
| État applicatif hors base de données (OTP, refresh tokens, rate limiting) | `docs/memory-system.md` |
| Intégrations externes (statut réel par fournisseur) | `integrations.md` |
| Logs, health check, ce qui manque en observabilité | `OBSERVABILITY.md` |
| Historique des changements | `CHANGELOG.md` |
| Avancement et prochaines étapes | `docs/roadmap.md` |
| Cahier des charges fonctionnel complet | `docs/cahier-de-charge/readme.md` |
| Règles pour les assistants IA sur ce dépôt | `CLAUDE.md`, `AGENTS.md`, `CURSOR.md` |

## FAQ rapide

**Pourquoi MongoDB et PostgreSQL coexistent dans le code ?**
Migration décidée par [ADR 0013](docs/adr/0013-migration-postgresql-prisma.md),
exécutée module par module pour garder le backend utilisable entre chaque
étape plutôt qu'une réécriture en un seul passage — voir `docs/roadmap.md`.

**Où sont les vraies fiches de rites (Tawaf, Sa'i...) ?**
Nulle part encore en base — c'est du contenu religieux, il doit être rédigé
puis validé par une personne qualifiée avant publication (issue #17, voir
`CLAUDE.md`).

**Le paiement Mobile Money fonctionne déjà ?**
Le module `payments` et son webhook existent côté API, mais aucun agrégateur
réel (Orange Money, MTN Money, carte) n'est branché — voir `integrations.md`
et [ADR 0006](docs/adr/0006-gestion-paiements.md) (encore `proposé`).

**Je veux ajouter une nouvelle dépendance ou changer un choix technique.**
Ça passe par un ADR d'abord, jamais silencieusement dans le code — voir
`docs/adr/README.md` et `CONTRIBUTING.md`.

**Où est le frontend web / l'app mobile ?**
Pas dans ce dépôt. Le back-office web (React) et l'app mobile (Flutter) sont
des dépôts séparés, non démarrés à ce stade (voir `docs/roadmap.md`,
Phases 3 et 4) — ils consommeront cette même API.
