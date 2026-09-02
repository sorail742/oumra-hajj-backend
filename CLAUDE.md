# CLAUDE.md

Instructions pour Claude (et tout assistant IA) travaillant sur ce dépôt.
À lire avant toute modification de code.

## Le projet

Plateforme numérique de gestion de la Oumra et du Hadj : back-office web
(agences, admin), API centrale, application mobile pèlerin/guide. Voir
`docs/cahier-des-charges.md` (ou le document Word fourni) pour le contexte
fonctionnel complet.

## Stack

- **Backend** : NestJS + TypeScript, MongoDB/Mongoose. Voir `docs/adr/0001-*`
  et `docs/adr/0002-*`.
- **Frontend web** : React + TypeScript (Vite).
- **Mobile** : Flutter/Dart (dépôt séparé), consomme la même API.
- Toute décision d'architecture nouvelle ou modifiée passe par un ADR
  (`docs/adr/NNNN-titre-court.md`) — voir `docs/adr/0011-conventions-git-branches.md`.
  **Ne jamais changer un choix déjà tranché par un ADR accepté sans en créer un
  nouveau qui le remplace.**

## Avant de coder

1. Lire `docs/adr/README.md` pour connaître les décisions déjà prises.
2. Si la tâche touche une zone non couverte par un ADR existant et implique un
   choix structurant (nouvelle dépendance majeure, changement de pattern
   d'architecture, nouveau service externe), proposer un ADR au format
   `proposé` avant d'implémenter, plutôt que de décider silencieusement dans le
   code.
3. Vérifier qu'une branche dédiée existe (`feature/<issue>-<titre>` ou
   `fix/<issue>-<titre>`, depuis `develop`) — ne jamais committer directement
   sur `develop` ou `main`.

## Conventions de code

- TypeScript strict (`strict: true`) sur backend et frontend web — pas de
  `any` non justifié.
- Backend : un module NestJS par domaine métier (`src/modules/<domaine>/`),
  DTO validés avec `class-validator`, schémas Mongoose séparés des DTO
  d'entrée/sortie. Voir `docs/adr/0002-*`.
- Pas de logique métier dans les contrôleurs : contrôleur = validation +
  appel service ; service = logique métier ; le contrôleur ne parle jamais
  directement à Mongoose.
- Aucune donnée sensible (documents pèlerins, secrets, clés API, données de
  paiement) ne doit apparaître dans un log, un message de commit, ou un
  exemple de code. Voir `docs/adr/0008-*` et `docs/adr/0006-*`.
- Toute fonctionnalité touchant aux paiements, aux documents sensibles ou au
  bouton SOS nécessite un test avant merge (voir `docs/adr/0010-*`).

## Tests et vérification

- Backend : `npm run test` (unitaire) et `npm run test:e2e` avant toute PR.
- Lint/format : `npm run lint` doit passer sans erreur.
- Ne jamais désactiver un test existant pour faire passer la CI sans
  justification explicite dans la description de la PR.

## Contenu religieux

Toute fiche de rite, Dua, ou texte à caractère religieux ajouté ou modifié
doit être signalé comme "à valider par une personne qualifiée" tant qu'il n'a
pas reçu de validation explicite — ne jamais publier ce type de contenu comme
final sans cette validation (voir `docs/adr/0008-*` et le cahier des charges,
section Sécurité et conformité).

## Ce que Claude ne doit pas faire seul

- Ne pas changer de base de données, de framework frontend, ou de fournisseur
  de paiement/SMS sans ADR validé au préalable.
- Ne pas fusionner (merge) vers `main` — cette branche reflète uniquement la
  production.
- Ne pas générer de fausses données de paiement ou de documents d'identité
  réalistes pour les tests ; utiliser des jeux de données factices explicites.
