# Dépendances de départ — DarMeuble frontend

Mêmes briques qu'`oumra-hadj-web-kit` (voir son propre
`dependances.md`), pour les mêmes raisons : TanStack Query/Table, Zustand,
react-hook-form + zod, sonner, next-themes, date-fns, tailwind-merge,
class-variance-authority, clsx, lucide-react, radix-ui.

**Ne pas copier de numéros de version** — à vérifier sur le registre npm au
moment de créer le projet, puis épingler sans `^`.

## Scripts

```json
{
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start -p 3010",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Non repris d'`oumra-hadj-web-kit`, sans besoin identifié à ce jour

- `recharts` — à ajouter dès qu'un tableau de bord réel (§5.9) en a besoin,
  pas avant.
- `react-dropzone` — utile dès que `MaintenanceRequestCard`/l'upload de
  documents (§5.10) est construit.

## À ajouter, propre à DarMeuble

- Un composant de génération/prévisualisation de graphique simple pour
  `ExpenseAllocationTable` — pas nécessairement une bibliothèque dédiée,
  une table suffit pour la répartition de charges (§5.6), un graphique
  n'est demandé que pour le tableau de bord (§5.9).
