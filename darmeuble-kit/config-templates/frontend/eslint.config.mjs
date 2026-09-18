import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Configuration ESLint à plat — identique dans son principe à celle
 * d'`oumra-hadj-web-kit` (même règle `import/no-restricted-paths` pour
 * l'isolation `features/x` / `features/y`). Vérifier la version de Next
 * réellement installée : `eslint-config-next` a changé de format
 * d'export entre versions (flat vs `FlatCompat`).
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'storybook-static/**',
      'coverage/**',
      'src/lib/api/generated.ts',
    ],
  },

  {
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',

      /**
       * Un dossier `features/x` n'importe jamais depuis `features/y`.
       * Trois espaces distincts (organization/tenant/super-admin, voir
       * docs/frontend/socle-frontend.md §1) rendent cette règle encore
       * plus importante que sur un projet à un seul espace : un import
       * croisé entre `features/leases` et `features/payments` signale
       * presque toujours un composant qui devrait vivre dans
       * `components/shared/`.
       */
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/features/*',
              from: './src/features/*',
              except: ['./'],
              message:
                'Un feature n’importe jamais depuis un autre feature. Remonter le code partagé dans components/shared/ ou lib/.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
