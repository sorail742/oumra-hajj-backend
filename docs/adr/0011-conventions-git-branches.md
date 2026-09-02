# 0011 — Conventions Git, branches et ADR

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Le projet doit rester lisible et traçable même si plusieurs personnes (ou
plusieurs assistants IA) y contribuent au fil du temps. On reprend la
convention déjà en place sur le projet SmartSMS.

## Décision

- **Branches** : une branche par issue, créée depuis `develop`, nommée
  `feature/<numéro-issue>-<titre-court>` (ex. `feature/12-module-paiements`),
  ou `fix/<numéro-issue>-<titre-court>` pour un correctif.
- **Commits** : format court et explicite, à l'impératif présent
  (`Ajoute le module payments`, `Corrige le calcul des tranches`) ; on peut
  suivre l'esprit "Conventional Commits" (`feat:`, `fix:`, `chore:`, `docs:`)
  sans obligation stricte d'outillage automatisé au démarrage.
- **Pull Request** : toujours vers `develop`, jamais directement vers `main`.
  `main` reflète uniquement ce qui est en production.
- **ADR** : un ADR par décision d'architecture ou de convention structurante,
  dans `docs/adr/NNNN-titre-court.md`, numéroté séquentiellement, indexé dans
  `docs/adr/README.md`. Statuts possibles : `proposé`, `accepté`, `déprécié`,
  `remplacé` (avec référence vers l'ADR qui remplace).
- Toute décision qui changerait un ADR existant (ex. changer de base de
  données, de framework frontend) crée un **nouvel** ADR qui remplace l'ancien
  — on ne réécrit jamais un ADR déjà accepté, on le marque `remplacé`.

## Conséquences

- Cohérence avec le reste des projets de la structure (CJP/ELNEX), ce qui
  facilite le passage d'un projet à l'autre pour les contributeurs.
- Impose une petite discipline (créer l'ADR avant/pendant la décision, pas
  après coup) — à rappeler dans `CONTRIBUTING.md`.
