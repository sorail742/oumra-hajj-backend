# CLAUDE.md — oumra-hadj-web

Frontend Next.js de la plateforme Oumra & Hadj (back-office agences/admin,
espace pèlerin). Consomme l'API REST de `Oumra-hadj-project` (NestJS), dont
le contrat vit dans `openapi.json`.

**Ce document est adapté de celui de `smartsms-frontend`, un projet frère,
après lecture complète et vérification contre notre propre backend — voir
`README.md` de ce kit pour le détail des écarts. Les règles ci-dessous ne
sont pas des suggestions.**

## Avant toute modification — lecture obligatoire

1. `docs/socle-frontend.md` — **§0 Décisions actées** en premier.
2. `docs/design-system.md` — tokens, comportement, catalogue des composants.
   À lire avant d'écrire un composant : il en existe peut-être déjà un.
3. `docs/coding-rules-frontend.md` — règles de dev concrètes.
4. `docs/contrat-api.md` — état réel du contrat API : pas d'enveloppe
   `{success,data,meta}`, pas de pagination serveur, format d'erreur NestJS
   par défaut. Ne jamais supposer le format de smartsms-frontend ici.
5. `docs/architecture.md` — arborescence cible et rôle du proxy.
6. `docs/adr/README.md` — décisions d'architecture actées ou proposées.
7. Ne jamais lire ni citer le contenu d'un fichier `.env`.

## Stack

Next.js App Router · React · TypeScript strict · Tailwind v4 (CSS-first) ·
shadcn/ui · TanStack Query v5 · TanStack Table v8 · Zustand · react-hook-form
+ zod · next-intl (fr) · Vitest · Playwright · Storybook.

**Versions à épingler sans `^`** dès que le scaffold existe — voir
`docs/socle-frontend.md` §2 pour la raison et les versions à vérifier au
moment de l'installation (celles de smartsms-frontend datent d'août 2026,
ne pas les recopier sans revérifier le registre npm).

Typographie : **Source Sans 3** (interface) + **IBM Plex Mono** (numéros de
téléphone, références de paiement, identifiants, clés d'API) via
`next/font/google` — voir `docs/design-system.md` §1 pour la justification.

## Typage strict — dès le premier fichier

`tsconfig.json` en mode strict (`strict`, `noImplicitAny`, `strictNullChecks`,
`noUncheckedIndexedAccess`), pas la configuration permissive d'un scaffold
par défaut — voir `config-templates/tsconfig.json` de ce kit, à copier tel
quel. **`any` interdit sous toute forme**, aucun accès à une valeur
potentiellement `undefined`/`null` sans contrôle explicite.

Le contrat `openapi.json` peut comporter des champs incomplets ou absents de
schéma. Dans ce cas : écrire un schéma zod dans `features/<domaine>/api/schemas.ts`
et en dériver le type. Jamais `any`, jamais `@ts-ignore` sans justification
écrite validée en revue.

## Règles non négociables

1. **Aucune valeur de style en dur.** Couleurs, rayons, ombres, tailles de
   texte viennent uniquement des tokens de `src/app/globals.css`.
2. **Un dossier `features/x` n'importe jamais depuis `features/y`.** Ce qui
   est partagé remonte dans `components/shared/` ou `lib/`. ESLint le
   vérifie (`import/no-restricted-paths`, voir `config-templates/eslint.config.mjs`).
3. **Server Component par défaut.** `'use client'` uniquement quand c'est
   nécessaire, le plus bas possible dans l'arbre. Jamais sur un `layout.tsx`.
4. **Pas de clé de requête en dur.** Toutes les clés TanStack Query viennent
   de `lib/api/query-keys.ts`.
5. **Permissions via `<Can role="…">`.** Jamais `user.role === 'agency'` en
   dur dans un composant — même si aujourd'hui les 4 rôles sont simples et
   plats (`pilgrim`, `agency`, `guide`, `admin`), centraliser évite de
   retrouver la comparaison éparpillée le jour où un rôle se subdivise (voir
   ADR 0021 proposé côté backend — multi-utilisateurs par agence).
6. **Quatre états sur tout écran de données** — chargement (squelette aux
   dimensions du contenu), vide, erreur, nominal. Via `AsyncBoundary`, pas
   réimplémentés écran par écran.
7. **Aucune chaîne de texte en dur.** Tout passe par `messages/fr.json`,
   messages d'erreur compris.
8. **Filtres et pagination dans l'URL**, pas dans un `useState`.
9. **Formatage centralisé.** `lib/format/` pour dates, GNF, téléphones,
   documents. Aucun `toLocaleString` dans un composant.
10. **Un seul registre de statuts.** `config/status-registry.ts` porte les
    enums de l'API (`BookingStatus`, `PaymentStatus`, `PilgrimDocumentStatus`,
    `AgencyValidationStatus`, `PackageStatus`, `DossierStepStatus`…).
    `<StatusBadge kind="booking" value={…} />`, jamais un mapping local.
11. **Un composant `ui/` ne s'ajoute que si un écran réel le demande.**
12. L'UI n'est jamais la seule barrière de sécurité pour une permission — **le
    backend est la source de vérité**.
13. **Tout contenu de rite ou de Dua affiché porte l'indicateur « à valider
    par une personne qualifiée »** tant que le backend ne signale pas de
    validation explicite. Ne jamais le masquer pour « faire plus fini » —
    c'est une exigence de `CLAUDE.md` du backend, pas un détail cosmétique.
14. **Aucun document pèlerin (passeport, visa…) n'est mis en cache navigateur
    au-delà de sa consultation.** Les URL d'accès sont signées et à courte
    durée de vie côté backend (voir ADR 0008 backend) — ne jamais les
    stocker, les précharger en liste, ni les exposer dans un attribut `src`
    persistant. Consommer, afficher, oublier.

## Authentification — ce qui diffère de smartsms-frontend

Le jeton ne va pas dans `localStorage`. Les Route Handlers de Next servent de
proxy : le navigateur parle à `/api/*` (Next), Next parle au backend en
ajoutant le `Bearer` lu dans un cookie `httpOnly` + `secure` + `sameSite=lax`
— voir `code-templates/app/api/proxy-catch-all/route.ts`.

**Contrairement à smartsms-frontend, notre backend a déjà un refresh token
avec rotation** (`POST /auth/refresh`, `docs/contrat-api.md` §Authentification).
Le proxy doit donc :

- tenter le renouvellement silencieux sur un `401` avant d'abandonner ;
- mettre en file les requêtes concurrentes pendant ce renouvellement, pour
  ne pas déclencher n+1 appels à `/auth/refresh` en parallèle ;
- effacer les deux cookies et rediriger vers `/login` seulement si le
  refresh échoue à son tour.

Voir `code-templates/lib/auth/session.ts` pour la structure des deux
cookies (`access`, `refresh`) et `docs/architecture.md` §Authentification
pour le détail.

**Deux parcours d'authentification distincts, comme côté backend (ADR 0003
backend)** :

- **Pèlerin / guide** : téléphone + OTP SMS (`POST /auth/otp/request`,
  `POST /auth/otp/verify`).
- **Agence / admin** : email + mot de passe (`POST /auth/agency/login`).

## Commandes

```bash
pnpm dev              # développement
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint .  (« next lint » retiré depuis Next 16)
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm storybook
pnpm api:types        # régénère src/lib/api/generated.ts depuis openapi.json
```

`src/lib/api/generated.ts` est généré. **Ne pas l'éditer à la main.**

## Style de contribution

- Commits en Conventional Commits, portée = nom de feature :
  `feat(bookings): ajoute le suivi des étapes du dossier`
- **Attribution des commits : suivre la convention en vigueur au moment du
  travail**, transmise par le système hôte (voir la note en tête de session)
  — ce document ne fige pas ce point, contrairement à smartsms-frontend qui
  l'interdit explicitement chez eux. Vérifier avant de committer plutôt que
  de supposer.
- Un composant de `ui/` ou `shared/` sans story Storybook n'est pas terminé.
- Vérifier en 360 px avant d'ouvrir une revue.

## Git — ce qui diffère de smartsms-frontend

`oumra-hadj-web` n'a, à sa création, aucun remote distant connu. Tant qu'un
remote n'est pas explicitement configuré et confirmé par l'utilisateur :

- branche dédiée (`feature/<sujet>` ou `fix/<sujet>`) depuis `develop`,
  jamais de commit direct sur `develop`/`main` — même convention que
  `Oumra-hadj-project` (voir son `CLAUDE.md`, ADR 0011) ;
- merge local `--no-ff` une fois le travail vérifié (lint, typecheck, tests) ;
- **rien poussé vers un remote sans demande explicite de l'utilisateur** —
  ne pas supposer qu'un flux de Merge Request GitLab existe simplement parce
  que le projet frère en a un.

Revoir cette section dès qu'un dépôt distant existe réellement pour
`oumra-hadj-web` : le flux GitLab de smartsms-frontend
(`docs/conventions-gitlab.md` de leur dépôt) est une référence solide à
reprendre à ce moment-là, pas avant.
