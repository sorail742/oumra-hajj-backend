# ADR-0006 — Soft delete sur les entités racines

## Statut

Proposé — repris de `smartsms-backend` (ADR-0015 de ce projet frère).

## Contexte

Le cahier des charges exige la traçabilité complète de l'historique de
location et de paiement (§5.2, §5.5, §5.12 "journal d'activité"). Une
suppression physique d'une entité racine (`Lease`, `Tenant`, `Building`)
casserait l'historique qui en dépend directement.

smartsms-backend a rencontré ce problème après coup — deux modèles
portaient déjà une colonne `deletedAt` mais leur repository appelait quand
même `.delete()`, faute de convention documentée avant le premier appel de
suppression.

## Décision

Soft delete (`deletedAt: DateTime?`) sur les entités racines de catégorie A :
`Organization`, `Building`, `Unit`, `Tenant`, `Lease`, `User`. Voir
`docs/backend/soft-delete.md` pour le détail complet (les quatre
catégories, la propagation en cascade explicite, le pattern SQL pour les
contraintes uniques partielles).

## Justification

Identique à smartsms-backend : fixer la convention **avant** le premier
appel de suppression réel, pas après avoir découvert l'incohérence en
audit. Le coût (une colonne, un index partiel par contrainte unique, un
filtre systématique en lecture) est mineur comparé au risque de perdre un
historique de paiement exigé par le cahier des charges lui-même.

## Conséquences

- Chaque contrainte unique d'une entité de catégorie A (`Organization.email`,
  `User.email`, `Unit` (`buildingId`, `reference`)) devient un index unique
  partiel (`WHERE deleted_at IS NULL`) — SQL brut dans la migration, Prisma
  ne le déclare pas nativement.
- Tout chemin de lecture d'une entité de catégorie A filtre `deletedAt: null`
  au niveau repository.
- `Payment` reste en catégorie D (cycle de vie par statut, jamais
  supprimé) — pas de `deletedAt` sur ce modèle, une confirmation
  différente serait incohérente avec le reste de son cycle de vie
  (`pending`/`succeeded`/`failed`/`refunded`).

## Alternatives écartées

**Suppression physique avec table d'archive séparée.** Écarté : duplique
le schéma, complique les migrations, pour un bénéfice équivalent à une
colonne `deletedAt` filtrée.
