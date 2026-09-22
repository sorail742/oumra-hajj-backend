# Architecture — oumra-hadj-web

Document à tenir à jour contre l'état réel du dépôt une fois le scaffold
créé — ne jamais supposer qu'une structure existe sans l'avoir vérifiée.
Pour les décisions et leur justification, voir `docs/adr/`.

## Stack

Next.js App Router · TypeScript strict · Tailwind v4 (CSS-first) · shadcn/ui
· TanStack Query v5 · TanStack Table v8 · Zustand · react-hook-form + zod ·
next-intl · Vitest · Storybook.

Versions à épingler sans `^` dès l'installation — voir
`docs/socle-frontend.md` §2. Décisions : `docs/adr/0001-*.md`.

## Arborescence cible

Voir `docs/socle-frontend.md` §3 pour le détail complet.

```
src/
├── app/
│   ├── (public)/           login, otp, register-agency, forgot-password
│   ├── (app)/               écrans applicatifs (pèlerin, agence, guide)
│   ├── (admin)/             validation des agences
│   ├── api/[...chemin]/    proxy vers le backend
│   ├── layout.tsx
│   └── providers.tsx        Query, next-intl, next-themes, <Toaster>
├── components/{ui,shared,layout}/
├── features/<domaine>/{api,components,hooks,schemas.ts,types.ts}
├── lib/{api,auth,format}/
├── config/                  status-registry, navigation
├── stores/
└── i18n/
```

**Un dossier `features/x` n'importe jamais depuis `features/y`.** Vérifié
par ESLint (`import/no-restricted-paths`), pas par la discipline — voir
`config-templates/eslint.config.mjs`.

## Le proxy — la pièce centrale

Le navigateur appelle `/api/…`, **jamais le backend directement**. Les Route
Handlers de `src/app/api/[...chemin]/route.ts` relaient en ajoutant l'en-tête
`Authorization` lu dans un cookie `httpOnly`.

Trois conséquences, identiques à smartsms-frontend :

- un XSS ne peut pas exfiltrer le jeton ;
- l'URL du backend (`BACKEND_URL`) reste hors du bundle, sans préfixe
  `NEXT_PUBLIC_` ;
- il n'y a plus de cross-origin, donc plus de CSRF à gérer explicitement.

**Différence à ne pas manquer** : notre backend a un refresh token en
rotation dès aujourd'hui (voir `docs/contrat-api.md`). Le proxy doit donc
faire plus que celui de smartsms-frontend — voir
`code-templates/app/api/proxy-catch-all/route.ts` et
`docs/socle-frontend.md` §5 pour le protocole de renouvellement et la file
d'attente de requêtes concurrentes.

**Exception au proxy : le flux calendrier ICS.** `GET /calendar/agency/:token/calendar.ics`
est un appel public direct au backend, sans JWT — voir
`docs/contrat-api.md`. Ne pas le faire transiter par le proxy authentifié.

## Backend consommé

`Oumra-hadj-project` (NestJS), sous `/api/v1/`. Le contrat vit dans
`openapi.json`, copié depuis le backend et versionné dans ce dépôt.

**Pas d'enveloppe `{success,data,meta}`, pas de pagination serveur, pas de
code d'erreur métier stable** — voir `docs/contrat-api.md` pour le détail et
la comparaison explicite avec le contrat de smartsms-backend, dont le
frontend frère documente une forme différente.

## Authentification

Access + refresh en rotation, jetons dans deux cookies `httpOnly` posés par
les Route Handlers — jamais dans `localStorage`. Voir
`docs/socle-frontend.md` §5 pour le protocole complet (deux parcours de
connexion, renouvellement silencieux, file d'attente de requêtes
concurrentes).

## Déploiement

Next.js tourne comme **serveur Node**, pas comme fichiers statiques — le
proxy l'exige, comme chez smartsms-frontend (des fichiers statiques ne
peuvent pas exécuter de Route Handler). `pnpm build` produit `.next/`,
servi par `pnpm start`.

Aucune infrastructure de déploiement n'est encore décidée pour ce dépôt —
à trancher et documenter dans un ADR le moment venu, plutôt que de supposer
celle de smartsms-frontend (Proxmox, reverse proxy, Ansible) sans
confirmation.

## Documentation liée

- `docs/socle-frontend.md` — décisions actées, couche data, conventions
- `docs/design-system.md` — tokens, comportement, catalogue de composants
- `docs/contrat-api.md` — état réel du contrat API
- `docs/adr/` — décisions d'architecture
