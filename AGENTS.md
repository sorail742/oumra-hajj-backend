# AGENTS.md

Ce fichier suit la convention ouverte AGENTS.md, lue par plusieurs outils IA
(au-delà de Claude). Le contenu détaillé et les règles de fond sont dans
`CLAUDE.md` — ce fichier en est un résumé opérationnel pour tout agent qui ne
lirait que celui-ci.

## Setup

```bash
# Backend
cd backend
npm install
npm run start:dev        # API sur http://localhost:3000/api/v1

# Frontend web
cd frontend
npm install
npm run dev
```

Variables d'environnement : copier `.env.example` vers `.env` dans chaque
dossier (`backend/`, `frontend/`) et renseigner les valeurs — ne jamais
committer de `.env` réel.

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm run lint` | Vérifie le style de code (backend et frontend) |
| `npm run test` | Tests unitaires backend (Jest) |
| `npm run test:e2e` | Tests end-to-end backend |
| `npm run build` | Build de production |

## Style de code

- TypeScript strict partout (backend NestJS, frontend React).
- Un module NestJS par domaine métier — voir `docs/adr/0002-*`.
- Pas de logique métier dans les contrôleurs/composants de présentation.
- Formatage via Prettier, lint via ESLint — corriger les erreurs de lint
  avant de proposer une PR, ne pas les ignorer.

## Avant de proposer une PR

1. `npm run lint` et `npm run test` passent sans erreur.
2. Toute décision d'architecture nouvelle est documentée par un ADR dans
   `docs/adr/` (voir `docs/adr/README.md` pour la liste existante et
   `docs/adr/0011-*` pour la convention).
3. La branche suit le format `feature/<issue>-<titre-court>` ou
   `fix/<issue>-<titre-court>`, créée depuis `develop`.
4. La PR cible `develop`, jamais `main`.
5. Aucune donnée sensible (documents pèlerins, clés API, secrets) n'apparaît
   dans le diff.

## Références

- `CLAUDE.md` — règles complètes et contexte projet.
- `docs/adr/README.md` — index des décisions d'architecture.
- `docs/cahier-des-charges.md` (ou document Word associé) — spécifications
  fonctionnelles complètes.
