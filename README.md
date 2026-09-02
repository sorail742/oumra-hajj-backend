# Oumra & Hadj — Backend

API centrale de la plateforme numérique de gestion de la Oumra et du Hadj :
back-office web (agences, admin) et application mobile pèlerin/guide
consomment cette même API.

NestJS + TypeScript strict + MongoDB/Mongoose. Voir `docs/adr/` pour les
décisions d'architecture qui encadrent ce dépôt (stack, auth, paiements,
documents sensibles, tests, conventions Git...).

## Démarrage rapide

```bash
npm install
cp .env.example .env   # renseigner les valeurs locales, ne jamais committer .env
npm run start:dev
```

L'API démarre sur `http://localhost:3000/api/v1`, la documentation Swagger
est disponible sur `http://localhost:3000/api/docs` (hors production).

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm run start:dev` | Démarre l'API en mode watch |
| `npm run lint` | ESLint + Prettier (doit passer sans erreur avant toute PR) |
| `npm run test` | Tests unitaires (Jest) |
| `npm run test:e2e` | Tests end-to-end (Jest + MongoDB en mémoire) |
| `npm run build` | Build de production (`dist/`) |

## Structure

Un module NestJS par domaine métier, sous `src/modules/` (voir
[`docs/adr/0002-architecture-modulaire-nestjs.md`](docs/adr/0002-architecture-modulaire-nestjs.md)) :

`auth`, `users`, `agencies`, `packages`, `bookings`, `payments`, `documents`,
`rites`, `groups`, `notifications`, `reviews`, `admin`, `health`.

`src/common/` regroupe guards, décorateurs et filtres transverses.
`src/config/` centralise la configuration (variables d'environnement).

## Documentation du projet

- [`docs/adr/README.md`](docs/adr/README.md) — index des décisions d'architecture (ADR)
- [`docs/cahier-de-charge/readme.md`](docs/cahier-de-charge/readme.md) — cahier des charges fonctionnel
- [`CLAUDE.md`](CLAUDE.md) — règles pour Claude / assistants IA
- [`AGENTS.md`](AGENTS.md) — résumé opérationnel multi-outils IA
- [`CURSOR.md`](CURSOR.md) — règles pour Cursor
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions de branches, commits, PR

## À noter

Les fournisseurs SMS/OTP, notifications push (FCM) et paiement Mobile Money
ne sont pas encore intégrés (voir ADR 0006 et 0009, statut "proposé" pour le
premier) : le code expose des interfaces avec des implémentations de
développement qui journalisent au lieu d'envoyer réellement.
