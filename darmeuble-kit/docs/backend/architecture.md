# Architecture — DarMeuble backend

À tenir à jour contre l'état réel du dépôt une fois le projet créé — ne
jamais supposer qu'un module est implémenté sans l'avoir vérifié dans
`src/`. Pour la stack et les décisions actées, voir
`docs/backend/socle-backend.md` ; pour leur justification, `docs/backend/adr/`.

## Vue d'ensemble

API REST NestJS, consommée par le frontend Next.js de DarMeuble (dépôt
séparé). Architecture multi-tenant : chaque enregistrement métier est
rattaché à une `Organization`, avec un contrôle systématique de
l'appartenance au tenant — voir `docs/backend/multi-tenant.md`.

## Couche HTTP transversale

- Préfixe `/api`, `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`), CORS restreint à l'URL du frontend.
- Succès : `ResponseInterceptor` global → `{ success: true, data, meta }`.
- Erreur : `AllExceptionsFilter` → `{ success: false, error: { statusCode, message, error, path, timestamp } }`.
- Pagination partagée : `PaginationQueryDto` (`page`, `limit`, `sortBy`,
  `sortOrder`).
- Swagger : `GET /api/docs`.
- Sécurité : `helmet` au boot, `ThrottlerGuard` global, `TenantScopeGuard`
  + `RolesGuard` sur les routes tenant-scopées, `CheckSuperAdmin` dédié
  pour les actions transverses (jamais un simple check de rôle `admin`
  dans le controller).

## Mapping module métier ↔ module NestJS

Voir `docs/backend/socle-backend.md` §3 pour l'arborescence complète et le
détail des choix (`units` comme sous-domaine de `buildings`, `tenants`
distinct de `users`).

## Pattern repository (port/adapter)

Voir `docs/backend/adr/0003-pattern-repository-port-adapter.md`. À
répliquer dès le premier module réel (`organizations`), pas généralisé
d'avance sur des modules encore vides.

## Ce qui n'existe pas encore un premier jour de projet

Tout, par construction — ce document décrit une cible, pas un état
constaté. La première vérification factuelle à faire, dès que le dépôt
existe, est de comparer son contenu réel à cette page et de corriger l'une
ou l'autre.
