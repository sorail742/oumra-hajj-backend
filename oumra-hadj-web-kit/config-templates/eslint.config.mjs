import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Configuration ESLint à plat.
 *
 * `eslint-config-next` (Next 16+) exporte directement au format flat : pas
 * de `FlatCompat`, qui échoue sur les versions récentes avec une erreur de
 * structure circulaire peu explicite. Vérifier ce point si la version de
 * Next installée diffère sensiblement de celle utilisée pour écrire ce
 * fichier.
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
      // Fichier généré depuis openapi.json — le linter n'a rien à y dire, et
      // ses erreurs se corrigent côté backend.
      'src/lib/api/generated.ts',
    ],
  },

  {
    // `import/no-restricted-paths` doit résoudre les alias `@/*` du tsconfig
    // pour savoir dans quel feature vit un import. Sans ce résolveur, la
    // règle échoue au lieu de vérifier quoi que ce soit.
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      // `any` interdit sous toute forme — règle du socle, vérifiée ici
      // plutôt que laissée à la revue.
      '@typescript-eslint/no-explicit-any': 'error',

      /**
       * Un dossier `features/x` n'importe jamais depuis `features/y`.
       *
       * C'est la règle qui permet à plusieurs contributeurs de travailler en
       * parallèle sans conflit permanent. Ce qui est partagé remonte dans
       * `components/shared/` ou `lib/`. La faire respecter par ESLint plutôt
       * que par la discipline est ce qui la rend effective.
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
