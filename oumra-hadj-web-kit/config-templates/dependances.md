# Dépendances de départ — oumra-hadj-web

**Ne pas copier de numéros de version depuis ce fichier ni depuis le
`package.json` de `smartsms-frontend`.** Les leurs datent du 30 août 2026 et
seront obsolètes au moment où `oumra-hadj-web` sera réellement installé.
Vérifier chaque version sur le registre npm au moment de l'installation,
puis l'épingler sans `^` (voir `docs/socle-frontend.md` §0 pour la raison).

## Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start -p 3010",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "storybook": "storybook dev -p 6007",
    "build-storybook": "storybook build",
    "api:types": "openapi-typescript ./openapi.json -o ./src/lib/api/generated.ts",
    "prepare": "husky"
  }
}
```

Port `3010` choisi arbitrairement pour ne pas entrer en collision avec le
backend (`3333`, voir `.env` d'`Oumra-hadj-project`) ni avec un éventuel
port par défaut d'un autre projet local (`smartsms-frontend` utilise déjà
`3001`) — à ajuster si un port est déjà réservé sur le poste de
développement.

**`eslint .` et non `next lint`** : la commande dédiée a été retirée à
partir de Next 16 (elle interprète alors « lint » comme un répertoire) —
vérifier ce point selon la version de Next réellement installée.

## Dépendances de production

Mêmes briques que `smartsms-frontend`, pour les mêmes raisons (voir
`docs/socle-frontend.md` §2) : TanStack Query/Table, Zustand,
react-hook-form + zod, next-intl, sonner, next-themes, date-fns (+ un module
de gestion de fuseau horaire), tailwind-merge, class-variance-authority,
clsx, lucide-react, radix-ui (ou les paquets Radix individuels, selon la
version de shadcn au moment de l'installation).

**Non repris de smartsms-frontend, sans besoin identifié à ce jour :**

- `recharts` — aucun graphe n'est spécifié dans le socle actuel
  (`docs/design-system.md`) ; à ajouter seulement quand un écran (ex.
  tableau de bord agence) en a réellement besoin, même principe que « un
  composant `ui/` ne s'ajoute que si un écran réel le demande ».
- `react-dropzone` — utile dès que `DocumentUploader` ou
  `FileDropzone` (dépôt de document pèlerin) est construit ; à ajouter à ce
  moment, pas en Phase 0.
- `motion` — aucune animation complexe identifiée au-delà de l'échelle de
  transition CSS de `docs/design-system.md`.

## Dépendances de développement

`openapi-typescript`, `vitest`, `@testing-library/react`,
`@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`,
`@vitest/coverage-v8`, `@playwright/test`, `husky`, `lint-staged`,
`eslint` + `eslint-config-next` + `eslint-import-resolver-typescript`,
`prettier`, `shadcn`, `storybook` (+ addons `a11y`, `docs`), `tailwindcss` +
`@tailwindcss/postcss`, `tw-animate-css`, `typescript`.

## Gestionnaire de paquets

**pnpm**, pas npm — voir `docs/coding-rules-frontend.md`. Un seul
`pnpm-lock.yaml` doit exister dans le dépôt ; un `package-lock.json` en plus
ferait diverger l'arbre de dépendances installé selon la commande utilisée.
