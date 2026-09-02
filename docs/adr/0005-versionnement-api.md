# 0005 — Stratégie de versionnement de l'API

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

L'API sert à la fois le front web (agence/admin) et l'application mobile Flutter,
laquelle ne se met pas à jour instantanément chez tous les utilisateurs (contrainte
de connectivité). Il faut pouvoir faire évoluer l'API sans casser les versions
mobiles déjà installées.

## Décision

Versionnement par URI : `/api/v1/...`, porté par le `VersioningType.URI` de NestJS.
Toute évolution non rétrocompatible d'un endpoint donne lieu à une nouvelle
version (`/api/v2/...`) plutôt qu'à une modification silencieuse du contrat
existant. Les DTO de réponse sont documentés via Swagger/OpenAPI
(`@nestjs/swagger`), généré automatiquement et publié sur un endpoint
`/api/docs` accessible en environnement de développement.

## Conséquences

- Cohérent avec la convention déjà en place sur le projet SmartSMS.
- Impose une politique de dépréciation claire (durée minimale de support d'une
  version avant retrait) à documenter dans `docs/adr/0005-...md` ou un futur ADR
  dédié si la politique se précise.
