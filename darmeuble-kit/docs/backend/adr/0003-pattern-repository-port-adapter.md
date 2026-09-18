# ADR-0003 — Pattern repository (port/adapter) pour l'accès aux données

## Statut

Proposé — repris de `smartsms-backend` (ADR-0003 de ce projet frère,
accepté et déjà appliqué à son module `clients`).

## Contexte

Si chaque service métier NestJS injecte directement `PrismaService`, la
logique métier devient couplée à Prisma : impossible de tester un service
sans base de données réelle (ou sans mock lourd de tout le client Prisma).
`Oumra-hadj-project` fait ce choix (injection directe) et l'assume pour un
projet à un contributeur principal, à l'échelle où il se trouve
aujourd'hui.

DarMeuble n'a pas ce profil : le cahier des charges vise plusieurs
contributeurs (§10, phases successives) sur un système multi-tenant qui
manipule des paiements — exactement le contexte où smartsms-backend a fait
le même arbitrage.

## Décision

Chaque module métier qui accède aux données suit un pattern port/adapter :

```
modules/<domaine>/
  <domaine>.module.ts
  repositories/
    <domaine>-repository.interface.ts   # le port : I<Domaine>Repository + jeton Symbol
    prisma-<domaine>.repository.ts      # l'adapter : seule classe du module qui importe PrismaService
```

- Le service métier injecte `@Inject(<DOMAINE>_REPOSITORY) private readonly repo: I<Domaine>Repository` —
  jamais `PrismaService` directement.
- Le module déclare `{ provide: <DOMAINE>_REPOSITORY, useClass: Prisma<Domaine>Repository }`
  et l'exporte.
- Un jeton `Symbol` est nécessaire car NestJS ne peut pas résoudre une
  interface TypeScript à l'exécution.

`organizations` sert de module de référence pour ce pattern (rôle
équivalent à `clients` chez smartsms-backend) — implémenté dès la Phase 1.

## Justification

Identique à celle de smartsms-backend : séparation entre logique métier et
persistance, testabilité sans base réelle, point unique par domaine où le
filtre `organizationId` (ADR-0002) est appliqué et vérifiable en un seul
endroit plutôt que dispersé dans chaque service.

## Conséquences

- **À répliquer au moment du portage réel de chaque module, pas
  généralisé d'avance** sur des modules encore vides — ce serait du code
  mort tant qu'aucun service ne l'utilise (même mise en garde que
  smartsms-backend).
- Coût : plus de fichiers et d'indirection par module qu'un accès direct à
  Prisma — accepté comme coût du découplage, cohérent avec le profil
  multi-contributeurs du projet.
- Risque de dérive : si un développeur (ou un agent) injecte
  `PrismaService` directement par simplicité, le bénéfice se perd module
  par module — à vérifier systématiquement en revue de code.

## Alternatives écartées

**Injection directe de `PrismaService`, comme Oumra-hadj-project.** Le bon
choix pour un projet plus petit à un contributeur principal ; pas pour un
SaaS multi-tenant visé pour plusieurs développeurs dès le départ.
