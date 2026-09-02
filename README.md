# Plateforme Oumra & Hadj

Plateforme numérique de gestion de la Oumra et du Hadj : back-office web
(agences, admin), API centrale, application mobile pèlerin/guide.

## Stack

- Backend : NestJS + TypeScript + MongoDB/Mongoose (`backend/`)
- Frontend web : React + TypeScript, Vite (`frontend/`)
- Mobile : Flutter/Dart (dépôt séparé)

## Documentation

- [`docs/adr/README.md`](docs/adr/README.md) — décisions d'architecture (ADR)
- [`CLAUDE.md`](CLAUDE.md) — règles pour Claude / assistants IA
- [`AGENTS.md`](AGENTS.md) — résumé opérationnel multi-outils IA
- [`CURSOR.md`](CURSOR.md) — règles pour Cursor
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions de branches, commits, PR

## Démarrage rapide

```bash
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

Voir `AGENTS.md` pour le détail des commandes et variables d'environnement.
