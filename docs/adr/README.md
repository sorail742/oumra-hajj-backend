# Architecture Decision Records — Plateforme Oumra & Hadj

Convention : un ADR par décision structurante, fichier `NNNN-titre-court.md`,
numérotation séquentielle, jamais réécrit une fois accepté (voir ADR 0011).

Statuts : `proposé` · `accepté` · `déprécié` · `remplacé`

| N° | Titre | Statut |
|----|-------|--------|
| [0001](0001-choix-stack-technique.md) | Choix de la stack technique globale | accepté |
| [0002](0002-architecture-modulaire-nestjs.md) | Architecture modulaire du backend NestJS | accepté |
| [0003](0003-strategie-authentification.md) | Stratégie d'authentification et d'autorisation | accepté |
| [0004](0004-base-de-donnees-orm.md) | Base de données et ODM | remplacé (0013) |
| [0005](0005-versionnement-api.md) | Stratégie de versionnement de l'API | accepté |
| [0006](0006-gestion-paiements.md) | Gestion des paiements (Mobile Money & carte) | proposé |
| [0007](0007-synchronisation-hors-ligne-mobile.md) | Synchronisation hors-ligne de l'application mobile | accepté |
| [0008](0008-stockage-documents-sensibles.md) | Stockage et sécurité des documents sensibles | accepté |
| [0009](0009-notifications.md) | Notifications (push et SMS de secours) | accepté |
| [0010](0010-strategie-tests.md) | Stratégie de tests | accepté |
| [0011](0011-conventions-git-branches.md) | Conventions Git, branches et ADR | accepté |
| [0012](0012-ci-cd-environnements.md) | CI/CD et environnements | proposé |
| [0013](0013-migration-postgresql-prisma.md) | Migration de MongoDB/Mongoose vers PostgreSQL/Prisma (remplace 0004) | accepté |
| [0014](0014-messagerie-agence-guide.md) | Messagerie pèlerin ↔ agence/guide | accepté |

Les ADR marqués `proposé` doivent être confirmés (passage à `accepté`) avant le
début de la phase du plan de développement à laquelle ils se rattachent.
