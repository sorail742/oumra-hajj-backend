# Architecture Decision Records — DarMeuble backend

Un fichier par décision, `NNNN-titre-court.md`, numérotation séquentielle.
Statuts : `proposé`, `accepté`, `déprécié`, `remplacé par ADR-xxxx` —
jamais réécrit une fois accepté (ajouter une section datée plutôt que
modifier le texte existant).

## Index

| ADR | Titre | Statut |
| --- | --- | --- |
| [0001](0001-stack-nestjs-prisma-postgresql.md) | Stack NestJS + Prisma + PostgreSQL | Accepté (imposé par le cahier des charges) |
| [0002](0002-multi-tenant-isolation-organization-id.md) | Isolation multi-tenant par `organizationId` | Proposé |
| [0003](0003-pattern-repository-port-adapter.md) | Pattern repository (port/adapter) | Proposé |
| [0004](0004-authentification-access-refresh-rotation.md) | Authentification : access/refresh avec rotation | Proposé |
| [0005](0005-integration-paiement-djomy.md) | Provider de paiement abstrait pour Djomy | Proposé |
| [0006](0006-soft-delete-entites-racines.md) | Soft delete sur les entités racines | Proposé |

Cinq des six sont `proposé` : elles documentent un choix déjà motivé dans
ce kit (en s'appuyant sur l'expérience vérifiée de deux projets frères),
mais n'ont pas encore été formellement validées par le porteur produit de
DarMeuble. Passage à `accepté` au moment où le projet démarre sur cette
base, ou remplacement par un nouvel ADR si le choix change en route.

## Quand créer un nouvel ADR

Pour toute décision qui engage l'architecture au-delà d'un composant
isolé : choix de librairie structurante, changement de stack, nouveau
service externe (fournisseur SMS, stockage objet, PDF). Proposer l'ADR
**avant** d'implémenter, jamais décider silencieusement dans le code — même
règle que sur les deux projets sources.
