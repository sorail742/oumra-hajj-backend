# Guide de contribution

## Branches

- Partir toujours de `develop`.
- Nommage : `feature/<numéro-issue>-<titre-court>` ou
  `fix/<numéro-issue>-<titre-court>` (ex. `feature/14-module-bookings`).
- Aucun commit direct sur `develop` ou `main`.

## Commits

- Message à l'impératif présent, court et explicite.
- Préfixe recommandé (esprit Conventional Commits, non obligatoire au
  démarrage) : `feat:`, `fix:`, `docs:`, `chore:`, `test:`.

## Pull Requests

- Toujours vers `develop`.
- Doit passer : lint, tests unitaires, tests e2e (backend).
- Doit inclure un ADR (`docs/adr/`) si elle introduit ou modifie une décision
  d'architecture (nouvelle dépendance structurante, changement de pattern,
  nouveau service externe). Voir `docs/adr/0011-conventions-git-branches.md`.
- Description de PR : quoi, pourquoi, comment tester — pas seulement "fix bug".

## ADR — quand en créer un

Créer un ADR pour : choix de base de données/ORM, choix de framework,
stratégie d'authentification, choix d'un provider externe (paiement, SMS,
stockage), stratégie de tests, stratégie de déploiement, ou tout changement
qui reviendrait sur un ADR déjà accepté.

Ne pas créer d'ADR pour : le choix d'une librairie utilitaire mineure, une
correction de bug, un refactor local sans impact d'architecture.

Procédure : dupliquer un ADR existant comme gabarit, numéroter séquentiellement
après le dernier ADR de `docs/adr/`, statut `proposé` tant que non validé par
le chef de département, puis mettre à jour `docs/adr/README.md`.

## Contenu religieux

Toute fiche de rite ou Dua ajoutée doit être marquée comme non publiée tant
qu'une personne qualifiée ne l'a pas validée (voir `CLAUDE.md`).

## Données sensibles

Ne jamais committer de vraies données personnelles (passeport, téléphone,
paiement) dans le code, les tests, ou les fixtures — utiliser des jeux de
données factices.
