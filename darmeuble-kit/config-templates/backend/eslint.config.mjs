// @ts-check
import { createRequire } from 'node:module';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Plugin local — règles projet non couvertes par les rulesets génériques
// (isolation multi-tenant Prisma, motif finalizeTransaction sur les
// paiements Djomy). Adapté de smartsms-backend/eslint.config.mjs — voir
// docs/backend/multi-tenant.md et docs/backend/paiements-djomy.md.
const require = createRequire(import.meta.url);
const darmeuble = require('./tools/eslint-rules/index.js');

// Table des modèles Prisma tenant-scopés, dérivée manuellement de
// `prisma/schema.prisma`. Volontairement pas dérivée du DMMF : ajouter un
// modèle métier doit forcer un passage explicite ici, sinon la table
// oubliée n'est pas contrôlée. À compléter au fur et à mesure de
// l'implémentation réelle des modules (voir docs/backend/socle-backend.md §3) —
// cette liste de départ reflète le modèle de données du cahier des charges
// (§7), pas un état de code déjà écrit.
const TENANT_SCOPED_MODELS = {
  building: ['organizationId'],
  unit: ['organizationId', 'buildingId'],
  tenant: ['organizationId'],
  lease: ['organizationId'],
  payment: ['organizationId'],
  expense: ['organizationId', 'buildingId'],
  maintenanceRequest: ['organizationId', 'unitId'],
  document: ['organizationId'],
  notification: ['organizationId'],
  user: ['organizationId'],
  subscription: ['organizationId'],
  activityLog: ['organizationId'],
  // Ces trois modèles n'ont pas de colonne `organizationId` propre dans le
  // schéma de départ (config-templates/backend/prisma/schema.prisma) — leur
  // appartenance passe par leur parent direct. Accepter la clef de la
  // relation parente plutôt que d'exiger `organizationId` partout : lui
  // ajouter une colonne dénormalisée est une option, pas une obligation
  // tant qu'aucune requête n'a besoin de filtrer directement dessus.
  rentSchedule: ['leaseId'],
  propertyInspection: ['leaseId'],
  buildingManager: ['buildingId'],
};

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      // Plugin ESLint local — JavaScript pur, hors du tsconfig applicatif.
      'tools/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // Seuil de conception, pas de blocage — voir
      // docs/backend/coding-rules-backend.md.
      'max-lines': [
        'warn',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'warn',
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      'max-depth': ['warn', 4],
      complexity: ['warn', 15],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['**/*.dto.ts'],
    rules: {
      'max-lines': 'off',
    },
  },
  {
    // Règles projet — isolation multi-tenant et verrou en base sur les
    // écritures financières. Portée : uniquement les repositories (ADR-0003 :
    // les services ne touchent jamais PrismaService directement). `warn` au
    // départ — passera en `error` une fois la baseline vidée, voir
    // docs/backend/coding-rules-backend.md.
    files: ['**/*.repository.ts'],
    plugins: { darmeuble },
    rules: {
      'darmeuble/require-organization-id-filter': [
        'warn',
        { models: TENANT_SCOPED_MODELS },
      ],
      'darmeuble/require-status-condition-on-write': [
        'warn',
        {
          models: {
            payment: { statusFields: ['status'] },
            subscription: { statusFields: ['status'] },
          },
          // Compteurs atomiques — écritures via `{ increment | decrement }`
          // sans garde de statut sont vulnérables au double-crédit sous
          // webhook Djomy concurrent. À compléter dès qu'un compteur de ce
          // type existe réellement (ex. `Unit.seatsTaken`-like s'il en
          // apparaît un).
          quotaFields: [],
        },
      ],
    },
  },
);
