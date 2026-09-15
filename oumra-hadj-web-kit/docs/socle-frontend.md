# Oumra & Hadj — Socle Frontend

Document de référence pour la mise en place du frontend Next.js
`oumra-hadj-web`. À lire avant la première ligne de code.

Adapté du socle de `smartsms-frontend` (projet frère, même écosystème) après
lecture complète de son dépôt et vérification de chaque règle contre notre
propre backend (`Oumra-hadj-project`). Voir le `README.md` de ce kit pour le
tableau des écarts assumés.

---

## 0. Décisions actées

Ce qui a été tranché, et qui ne se rediscute pas sans raison nouvelle.

| Sujet | Décision |
| --- | --- |
| Framework | Next.js, App Router — version stable la plus récente au moment de l'installation, **épinglée sans `^`** une fois choisie |
| React | Version acceptée par le Next choisi, épinglée |
| Typographie | **Source Sans 3** (interface) + **IBM Plex Mono** (données), via `next/font/google` |
| Couleur de marque | Sage/vert profond — voir `docs/design-system.md` §2 pour la valeur OKLCH exacte |
| Accent | Or/ambré — réservé aux marqueurs de confiance et de statut premium (badge agence certifiée, idée #61 backend) |
| Mode sombre | Tokens écrits dès le départ, **validation par composant différée** — même logique que smartsms : corriger sur un petit catalogue plutôt que sur trente écrans |
| Primitives shadcn | **Trois vagues**, pas une commande — voir `docs/design-system.md` §7 |
| Règle de progression | La vague 1 doit produire **un écran réel** avant que la vague 2 commence |
| `DataTable` | API regroupée par préoccupation, pas une liste de props aplatie |
| Badges de statut | Un `StatusBadge` **générique** + registre central — 9 enums aujourd'hui, pas un badge par domaine |
| Quatre états | Outillés par `AsyncBoundary`, pas laissés à la discipline |
| Authentification | Deux parcours (OTP téléphone pour pèlerin/guide, email+mot de passe pour agence/admin), **access + refresh avec rotation** déjà disponibles côté backend — voir §5 |
| Contenu religieux | Toute fiche de rite/Dua affichée porte un indicateur de validation tant que non confirmée par le backend — non négociable, hérité de `CLAUDE.md` du backend |

### Pourquoi le mode sombre est différé

Même raisonnement que smartsms-frontend : les tokens sombres sont écrits et
soignés, ce qui est différé c'est la **vérification** de chaque composant
dans les deux thèmes. Se valide en une passe dédiée, une fois les écrans
réels construits.

### Pourquoi les versions sont épinglées

Un `^` fait qu'une installation une semaine plus tard obtient une version
différente de Next/React/Tailwind — et un bug qui ne se reproduit que sur un
poste. Épingler rend la montée de version explicite : une décision, un
commit.

---

## 0bis. Décisions en attente

| Sujet | En attente de | Ce qui est bloqué |
| --- | --- | --- |
| Identité visuelle définitive | Validation utilisateur/produit | Logo, favicon, page de connexion |
| Multi-utilisateurs par agence | ADR 0021 backend (`proposé`) | Écran de gestion des membres d'une agence |
| Dons/sadaqa vérifiés | ADR 0022 backend (`proposé`) | Écran de don pèlerin |
| Rôle gouvernemental, KYC renforcé, canal SMS/USSD, assurance voyage, microfinance | ADR 0015/0017/0018/0019/0020 backend (tous `proposé`) | Écrans correspondants — voir `docs/backlog-100-fonctionnalites.md` du backend |
| Remote Git distant | Décision utilisateur | Le flux de Merge Request (voir `CLAUDE.md` de ce kit, section Git) |

Ce qui dépend de l'identité visuelle : utiliser un placeholder textuel
d'ici là, jamais une image provisoire — un logo temporaire finit toujours en
production (même mise en garde que smartsms-frontend, et elle s'est révélée
juste chez eux).

---

## 1. Ce que ce socle décide, et ce qu'il ne décide pas

**Il décide** : la stack, l'arborescence, les tokens de design, l'API des
composants transverses, la couche data, l'auth, les conventions, la
définition de « terminé ».

**Il ne décide pas** : le code des composants et des écrans métier
(campagnes → chez smartsms ; forfaits, dossiers, rites → ici).

---

## 2. Stack

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Framework | Next.js App Router | Server Components, proxy via Route Handlers indispensable pour le cookie `httpOnly` (voir §5) |
| Langage | TypeScript `strict` | `strict: true` + `noUncheckedIndexedAccess` dès le premier fichier |
| UI | React (version acceptée par Next) | — |
| CSS | Tailwind v4, config CSS-first (`@theme`), couleurs OKLCH | Cohérent avec le token unique de vérité dans `globals.css` |
| Composants | shadcn/ui (Radix + CVA) | Le code est copié dans le repo, l'équipe le possède — pas un `node_modules` à contourner pour le style |
| Icônes | lucide-react | Livré avec shadcn |
| État serveur | TanStack Query v5 | Cache, invalidation, retry, remplace un client HTTP à état |
| État client | Zustand | Uniquement pour ce qui n'est pas de la donnée serveur |
| Formulaires | react-hook-form + zod | zod sert aussi à valider les réponses API incomplètes |
| Tableaux | TanStack Table v8 | Tri/filtre/pagination — actuellement **côté client uniquement**, voir §4 |
| i18n | next-intl | **fr** par défaut, seule langue à ce jour |
| Types API | openapi-typescript | Génère depuis `openapi.json`, régénéré à chaque évolution du contrat backend |
| Toasts | sonner | Livré avec shadcn |
| Tests | Vitest + Testing Library + Playwright | Unitaire / composant / e2e |
| Catalogue | Storybook | Contrat visuel entre plusieurs contributeurs, y compris futurs |
| Qualité | ESLint flat + Prettier + Husky + lint-staged | — |

### Sur shadcn/ui — le même malentendu qu'ailleurs

`pnpm dlx shadcn@latest add button` **n'installe aucune dépendance** : la
commande copie `components/ui/button.tsx` dans le repo. Ce qui est fourni :
l'accessibilité (Radix), les variants (CVA). Ce qui reste à faire : **tout le
design**, parce que les tokens du design system remplacent le thème par
défaut.

### Typographie

**Source Sans 3** pour l'interface, **IBM Plex Mono** pour tout ce qui se
lit caractère par caractère : numéros de téléphone, références de paiement
(`providerReference`), UUID de réservation, montants en GNF, clés d'accès
signées. Chargées par `next/font/google`, sous-ensemble `latin`,
`display: swap`.

IBM Plex Mono distingue clairement `0`/`O` et `1`/`l` — même critère que le
choix de JetBrains Mono chez smartsms, retenu ici pour la continuité avec
l'identité déjà utilisée dans les documents « Parcours Pèlerin » et « Cent
Fonctionnalités » publiés côté produit.

---

## 3. Arborescence

```
oumra-hadj-web/
├── src/
│   ├── app/
│   │   ├── (public)/                 # non authentifié
│   │   │   ├── login/                # agence / admin — email + mot de passe
│   │   │   ├── otp/                  # pèlerin / guide — téléphone + OTP
│   │   │   ├── register-agency/      # inscription agence (POST /agencies/register)
│   │   │   └── forgot-password/
│   │   ├── (app)/                    # authentifié — layout avec sidebar + header
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── packages/             # forfaits (agence)
│   │   │   ├── bookings/             # réservations et suivi de dossier
│   │   │   ├── documents/            # coffre-fort documents pèlerin
│   │   │   ├── payments/             # paiements, remboursements
│   │   │   ├── reviews/              # avis, score de confiance
│   │   │   ├── rites/                # fiches de rites, suivi de progression
│   │   │   ├── trip-summary/         # livret souvenir (idée #23)
│   │   │   ├── legal-documents/      # conformité documentaire agence (idée #56)
│   │   │   ├── calendar/             # calendrier des échéances (idée #70)
│   │   │   ├── groups/               # groupes, bouton SOS
│   │   │   ├── messaging/            # messagerie pèlerin ↔ agence/guide
│   │   │   └── settings/
│   │   ├── (admin)/                  # admin uniquement — validation agences
│   │   │   └── agencies/
│   │   ├── api/                      # Route Handlers — proxy BFF, voir §5
│   │   ├── layout.tsx
│   │   └── globals.css               # tokens Tailwind v4
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn — primitives, aucune logique métier
│   │   ├── layout/                   # AppShell, Sidebar, Header, Breadcrumbs
│   │   └── shared/                   # DataTable, PageHeader, EmptyState, Can,
│   │                                  # StatusBadge, ReligiousContentNotice…
│   │
│   ├── features/                     # 1 dossier = 1 domaine métier backend
│   │   ├── agencies/
│   │   ├── packages/
│   │   ├── bookings/
│   │   ├── documents/
│   │   ├── payments/
│   │   ├── reviews/
│   │   ├── rites/
│   │   ├── trip-summary/
│   │   ├── groups/
│   │   └── <domaine>/
│   │       ├── api/                  # hooks TanStack Query + schémas zod
│   │       ├── components/           # composants propres au domaine
│   │       ├── hooks/
│   │       ├── schemas.ts            # zod des formulaires
│   │       └── types.ts
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── backend.ts            # URL + préfixe /api/v1, jamais côté navigateur
│   │   │   ├── client.ts             # fetch wrapper, erreurs, auth
│   │   │   ├── query-keys.ts         # fabrique centrale de clés
│   │   │   └── generated.ts          # openapi-typescript — NE PAS ÉDITER
│   │   ├── auth/                     # session (access+refresh), permissions
│   │   ├── format/                   # dates, GNF, téléphones, documents
│   │   └── utils.ts                  # cn()
│   │
│   ├── config/                       # navigation, rôles, status-registry
│   ├── stores/                       # zustand
│   └── types/
│
├── .storybook/
├── e2e/
├── CLAUDE.md
└── openapi.json                      # copié depuis Oumra-hadj-project, versionné
```

### La règle qui fait tenir l'ensemble

> Un dossier `features/x` **n'importe jamais** depuis `features/y`.

Ce qui est partagé remonte dans `components/shared` ou `lib`. Faire
respecter la règle par ESLint, pas par la discipline — voir
`config-templates/eslint.config.mjs` de ce kit, prêt à copier.

---

## 4. Couche data

### Le format réel du backend — à ne pas confondre avec smartsms

Notre backend (`Oumra-hadj-project`) **n'a pas d'enveloppe de réponse
unifiée**. Pas de `ResponseInterceptor` global : un appel réussi renvoie le
DTO directement (`{ id, legalName, … }`, pas `{ success, data, meta }`).

Les erreurs suivent le format par défaut de NestJS
(`HttpExceptionFilter` du backend) :

```ts
{
  statusCode: number,
  timestamp: string,   // ISO
  path: string,
  message: string | string[],  // tableau sur erreur de validation class-validator
  error?: string,               // ex. "Bad Request" — pas systématique
}
```

**Aucun code d'erreur métier stable aujourd'hui** (pas de champ `code`
comparable à celui de smartsms) : un quota dépassé et un email invalide
renveraient tous deux un statut HTTP sans distinction programmatique au-delà
du `message`. Voir `docs/contrat-api.md` pour la stratégie retenue en
attendant.

### Aucune pagination côté serveur, nulle part, à ce jour

Vérifié sur l'ensemble des contrôleurs backend : aucun paramètre `page`,
`skip` ou `take` n'est exposé. `GET /packages`, `GET /agencies`,
`GET /reviews/agency/:id`… renvoient un tableau complet.

`DataTable` pagine donc **systématiquement côté client** pour l'instant —
pas de branche « pagination serveur » à maintenir en double comme chez
smartsms. Le jour où le backend introduit une vraie pagination sur un
endpoint volumineux, adapter `lib/api/client.ts` à cet endroit précis,
jamais dans un composant.

### En attendant un contrat totalement stable : zod à la frontière

Même principe que smartsms-frontend. Chaque endpoint consommé a un schéma
zod dans `features/<domaine>/api/schemas.ts` :

```ts
// features/bookings/api/schemas.ts
export const bookingSchema = z.object({
  id: z.uuid(),
  pilgrimId: z.uuid(),
  packageId: z.uuid(),
  agencyId: z.uuid(),
  status: z.enum(["pending_payment", "confirmed", "cancelled", "completed"]),
  steps: z.array(
    z.object({
      key: z.enum(["payment", "visa", "flight", "vaccination", "documents"]),
      status: z.enum(["pending", "in_progress", "done"]),
      updatedAt: z.iso.datetime().optional(),
    }),
  ),
});
```

Une fois `openapi.json` stable et complet, ces schémas se réduisent à des
types générés. Ils ne sont pas du travail jeté : ils restent la garantie
d'exécution, exactement comme documenté côté smartsms.

### Clés de requête — une seule fabrique

```ts
// lib/api/query-keys.ts
export const keys = {
  bookings: {
    all: ["bookings"] as const,
    list: (f: BookingFilters) => [...keys.bookings.all, "list", f] as const,
    detail: (id: string) => [...keys.bookings.all, "detail", id] as const,
    tripSummary: (id: string) =>
      [...keys.bookings.all, "trip-summary", id] as const,
  },
  // …un bloc par domaine, voir code-templates/lib/api/query-keys.ts
} as const;
```

Interdit : écrire un tableau de clé en dur dans un composant.

---

## 5. Authentification

### Ce que l'API impose

- **Pèlerin / guide** : `POST /auth/otp/request` (téléphone) puis
  `POST /auth/otp/verify` (téléphone + code) → `{ accessToken, refreshToken }`.
- **Agence / admin** : `POST /auth/agency/login` (email + mot de passe) →
  même forme de réponse.
- **Renouvellement** : `POST /auth/refresh` (refreshToken) → nouvelle paire
  de jetons, avec rotation (l'ancien refresh token est invalidé).
- **Déconnexion** : `POST /auth/logout` (Bearer + refreshToken) → révoque le
  refresh token côté serveur.

C'est un contrat **access + refresh déjà complet**, contrairement à
smartsms-frontend qui documente l'absence de refresh comme une limitation
backend assumée. Ne pas recopier leur choix de ne pas construire de file
d'attente de requêtes : ici, elle a un backend à servir.

### Ce que le frontend met en place

**Le jeton ne va pas dans `localStorage`.** Les Route Handlers de Next
servent de proxy : le navigateur parle à `/api/*` (Next), Next parle au
backend en ajoutant le `Bearer` lu dans un cookie `httpOnly`.

Deux cookies, pas un :

| Cookie | Contenu | Durée | Accessible à |
| --- | --- | --- | --- |
| `oumra_access` | `accessToken` | alignée sur `JWT_ACCESS_EXPIRES_IN` backend (15 min par défaut) | Route Handlers uniquement |
| `oumra_refresh` | `refreshToken` | alignée sur `JWT_REFRESH_EXPIRES_IN` backend (30 jours par défaut) | Route Handlers uniquement |

**Sur un `401` du backend**, le proxy :

1. tente `POST /auth/refresh` avec `oumra_refresh` ;
2. si ça réussit : rejoue la requête d'origine avec le nouveau
   `oumra_access`, pose les deux nouveaux cookies ;
3. si ça échoue : efface les deux cookies, répond `401` au navigateur, qui
   redirige vers `/login`.

**Requêtes concurrentes pendant un refresh** : la première déclenche le
renouvellement, les suivantes attendent son résultat au lieu d'appeler
`/auth/refresh` chacune de son côté — voir
`code-templates/lib/auth/session.ts` pour un point de départ. C'est
précisément la file d'attente que smartsms-frontend écarte comme « code
mort » chez eux ; ici c'est le contraire, l'omettre laisserait échouer
plusieurs requêtes simultanées après une expiration au lieu d'une seule
tentative de renouvellement.

**`middleware.ts`** ne vérifie que la **présence** du cookie d'accès, jamais
sa validité — le backend reste seule source de vérité. Un cookie présent
mais expiré passe le middleware, puis le proxy le refuse et déclenche le
renouvellement décrit ci-dessus.

### Durée de vie — à vérifier au câblage, pas à supposer

Les valeurs par défaut du backend (`src/config/configuration.ts`) sont
`JWT_ACCESS_EXPIRES_IN=15m` et `JWT_REFRESH_EXPIRES_IN=30d`, mais ce sont des
variables d'environnement : **lire la valeur réellement déployée avant de
figer une durée de cookie**, ne jamais recopier ces valeurs par défaut sans
vérification si un environnement les redéfinit.

---

## 6. Rôles et permissions

Quatre rôles, à plat, aucune matrice de permissions :

```
pilgrim · agency · guide · admin
```

Le rôle vit dans le payload du JWT (`JwtPayload.role`), lu côté serveur par
le proxy ou un Route Handler dédié à exposer `GET /me`-équivalent si besoin
(à confirmer contre `openapi.json` — aucune route `/me` n'a été repérée à ce
jour côté backend, contrairement à smartsms qui en a trois).

```tsx
<Can role={["agency", "admin"]}>
  <Button>Créer un forfait</Button>
</Can>
```

**Pas de `<Can do="permission.precise">`** comme chez smartsms : leur
matrice de 38 permissions n'a pas d'équivalent ici. Si le backend introduit
un jour des sous-rôles (voir ADR 0021 backend, proposé — multi-utilisateurs
par agence), `<Can>` gagnera une prop `permission` à ce moment, pas avant.

### Portée des rôles, par ce qu'on sait du backend

| Rôle | Peut |
| --- | --- |
| `pilgrim` | Réserver, payer, téléverser ses documents, suivre son dossier, laisser un avis, déclencher le SOS |
| `guide` | Accompagner un groupe, recevoir les messages agence, voir les besoins du groupe |
| `agency` | Créer/gérer ses forfaits, valider les documents, gérer les remboursements, voir son score de confiance, gérer ses documents légaux et son calendrier |
| `admin` | Valider/rejeter une agence, accès transverse |

Pas de rôle en lecture seule type « gouvernement » côté backend actuel — à
la différence de smartsms, dont trois rôles (`gouvernement`,
`responsable_regional`, `observateur`) existent déjà en base sans compte de
démonstration. Ici, ce rôle est **encore un ADR proposé** (0015 backend) :
ne pas construire d'écran pour un rôle qui n'existe pas dans
`role.enum.ts`.

---

## 7. Conventions

**Nommage**

- Fichiers composants : `PascalCase.tsx` — Hooks : `useCamelCase.ts` — Reste :
  `kebab-case.ts`
- Un composant par fichier, export nommé (pas de `default` sauf pages Next)

**Server / Client Components**

- Par défaut : Server Component
- `'use client'` seulement au besoin, le plus bas possible dans l'arbre
- Interdit : `'use client'` sur un `layout.tsx`

**Formulaires** : react-hook-form + zodResolver, systématiquement.

**Erreurs** : `error.tsx` par segment de route. Pas de `try/catch` silencieux.
Un message dit ce qui s'est passé et ce qu'on peut faire.

**Commits** : Conventional Commits, portée = nom de feature.

---

## 8. Définition de « terminé »

- [ ] `pnpm typecheck` et `pnpm lint` passent, aucun `any`, aucun `@ts-ignore`
- [ ] Les états chargement / vide / erreur sont traités, pas seulement le
      cas nominal
- [ ] Aucune couleur, taille ou espacement en dur — uniquement des tokens
- [ ] Navigable au clavier, focus visible
- [ ] Testé en mobile (360 px) et en dark mode
- [ ] Story Storybook pour tout composant de `ui/` ou `shared/`
- [ ] Textes en français, dans `messages/fr.json`
- [ ] Permissions vérifiées via `<Can>`, pas via le rôle en dur
- [ ] Tout contenu de rite/Dua porte son indicateur de validation si non
      confirmé par le backend

---

## 9. Ordre de construction suggéré

Sans répartition d'équipe figée (à la différence de smartsms, qui planifiait
pour huit développeurs) — un ordre qui reste valable en solo ou à plusieurs.

**Phase 0 — socle.** Scaffold Next, TS strict, ESLint/Prettier/Husky,
`lib/api/{backend,client,query-keys}.ts`, proxy + auth (§5), `AppShell`
minimal.

**Phase 1 — composants transverses.** `DataTable`, `PageHeader`,
`EmptyState`, `Can`, `StatusBadge` + `status-registry.ts`, `AsyncBoundary`.
Vague 1 shadcn (§2 design-system.md) validée sur un écran réel — la liste
des forfaits (`GET /packages`) est le meilleur candidat : liste paginée
côté client, filtres, quatre états, badges de statut.

**Phase 2 — écrans, par domaine backend.** Forfaits → réservations →
documents → paiements → avis/score de confiance → rites → livret souvenir →
groupes/SOS → messagerie → conformité documentaire agence → calendrier
agence. Cet ordre suit celui d'implémentation côté backend cette même nuit,
donc l'ordre où le contrat API est le plus stable en premier.

L'espace `(admin)` (validation des agences) peut arriver tôt malgré son
public restreint : c'est un blocage réel pour tester le reste (une agence
non approuvée ne peut pas créer de forfait, voir `AgenciesService.assertApproved`
côté backend).

---

## 10. Premières commandes

```bash
pnpm create next-app@latest oumra-hadj-web \
  --typescript --tailwind --app --src-dir --import-alias "@/*"

cd oumra-hadj-web
pnpm dlx shadcn@latest init

pnpm add @tanstack/react-query @tanstack/react-table zustand \
  react-hook-form @hookform/resolvers zod next-intl date-fns \
  sonner next-themes

pnpm add -D openapi-typescript vitest @testing-library/react \
  @playwright/test husky lint-staged @commitlint/cli
```

Génération des types API — à relancer après chaque mise à jour
d'`openapi.json` (régénéré côté backend via `npm run openapi:export`) :

```bash
pnpm dlx openapi-typescript ./openapi.json -o ./src/lib/api/generated.ts
```

À câbler en CI dès qu'un pipeline existe : si le fichier généré diffère de
celui commité, la CI échoue — c'est ce qui empêche le frontend de dériver
silencieusement du backend.
