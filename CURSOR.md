# CURSOR.md

Règles pour Cursor sur ce dépôt. Contenu aligné avec `CLAUDE.md` et
`AGENTS.md` — les trois fichiers doivent rester cohérents entre eux ; en cas
de modification d'une règle de fond, mettre à jour les trois.

## Contexte rapide

- Backend NestJS + TypeScript + PostgreSQL/Prisma (`backend/`).
- Frontend React + TypeScript, Vite (`frontend/`).
- Mobile Flutter/Dart dans un dépôt séparé (non couvert par ce dépôt).
- Décisions d'architecture tracées dans `docs/adr/` — les consulter avant
  toute suggestion touchant à la structure du projet, à la base de données,
  à l'authentification ou aux intégrations tierces (paiement, SMS, stockage).

## Comportement attendu dans l'éditeur

- Respecter le découpage `src/modules/<domaine>/` du backend (voir
  `docs/adr/0002-*`) : ne pas proposer de code métier dans `common/` ou dans
  un contrôleur d'un autre module.
- Compléter les DTO avec des décorateurs `class-validator` systématiquement
  pour toute entrée utilisateur.
- Ne jamais suggérer de stocker un fichier (passeport, visa, billet) en base
  de données — uniquement sa métadonnée (voir `docs/adr/0008-*`).
- Ne jamais suggérer de logguer une donnée sensible (téléphone complet en
  clair dans un log de debug, contenu de document, secret, token).
- Pour toute nouvelle dépendance externe significative (SDK de paiement,
  provider SMS, service de stockage), signaler qu'un ADR doit être créé plutôt
  que de l'ajouter silencieusement au `package.json`.

## Pour aller plus loin

Ce fichier est un résumé pensé pour l'auto-complétion Cursor. Le détail des
règles, du contexte fonctionnel et des conventions de contribution est dans
`CLAUDE.md`, `AGENTS.md` et `CONTRIBUTING.md`.

> Si l'équipe adopte plus tard le mécanisme natif de règles Cursor
> (`.cursor/rules/*.mdc`), reprendre ce contenu dans ces fichiers sans le
> dupliquer indéfiniment — un seul fichier source de vérité par règle.
