# Versionnement de l'API

Référence : [ADR 0005](adr/0005-versionnement-api.md) (accepté).

## Règle

Toutes les routes sont préfixées `/api/v{N}/...` via
`VersioningType.URI` de NestJS (voir `src/setup-app.ts`), version par défaut
`1`. Exemple : `GET /api/v1/packages`.

## Pourquoi

L'API sert à la fois le back-office web (mise à jour immédiate) et
l'application mobile Flutter, dont les utilisateurs ne mettent pas
forcément à jour l'app dès qu'une nouvelle version sort. On ne casse jamais
un contrat déjà publié pour une version mobile en circulation.

## Quand créer une v2

Une évolution est **non rétrocompatible** (donc nécessite `/api/v2/...`) si
elle :

- supprime ou renomme un champ de réponse existant ;
- change le type ou la sémantique d'un champ existant ;
- rend obligatoire un paramètre auparavant optionnel ;
- change le code de statut HTTP attendu pour un cas déjà documenté.

Une évolution **reste en v1** si elle :

- ajoute un champ optionnel en réponse ;
- ajoute un nouvel endpoint ;
- ajoute un paramètre de requête optionnel.

## Comment introduire une v2

1. Dupliquer le contrôleur concerné (ou une méthode) sous une nouvelle
   version : `@Controller({ path: 'packages', version: '2' })` ou
   `@Version('2')` sur la méthode concernée.
2. Documenter le changement dans le corps de la Merge Request (quoi, pourquoi,
   impact mobile/web).
3. Ne jamais supprimer la v1 sans une politique de dépréciation validée (délai
   minimal de support à définir — voir `roadmap.md`, point ouvert).

## Contrat de types

`src/types/` centralise les formes de réponse (`*Shape`) exposées par
l'API, indépendamment du stockage (Mongoose aujourd'hui, Prisma après
migration — voir [ADR 0013](adr/0013-migration-postgresql-prisma.md)). Toute
évolution de champ de réponse doit être reflétée ici en premier — c'est la
référence pour le contrat mobile/web (voir [ADR 0001](adr/0001-choix-stack-technique.md),
"définition de contrat d'API claire").

## Documentation vivante

Swagger/OpenAPI est généré automatiquement (`@nestjs/swagger`) et exposé sur
`/api/docs` en dev/staging (désactivé en production, voir `src/main.ts`).
Chaque DTO doit porter des `@ApiProperty()`/`@ApiPropertyOptional()` pour que
la doc reste utile aux équipes web et mobile.
