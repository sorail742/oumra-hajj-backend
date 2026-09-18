# Coding rules — DarMeuble backend

Règles concrètes, reprises pour l'essentiel de `smartsms-backend` (projet
frère au profil le plus proche : SaaS multi-tenant, plusieurs
contributeurs, données financières). Destiné à tout contributeur, humain
ou agent.

## Typage strict — règle absolue, sans exception

- **`any` interdit, sous toute forme** — ni déclaration explicite, ni
  implicite, ni contournement (`as any`, `@ts-ignore` sans justification
  écrite validée en revue).
- **Aucun accès à une valeur potentiellement `undefined`/`null` sans
  contrôle explicite.** `strictNullChecks` et `noUncheckedIndexedAccess`
  actifs dès le premier `tsconfig.json`.
- **Non-null assertion (`foo!.bar`) interdite** — contournement silencieux
  de `strictNullChecks`. Si une valeur est garantie non-null par
  construction, l'exprimer par le typage (retour de fonction non-optionnel,
  garde de type), pas par une assertion.
- Vérifié par `tsc --noEmit` + ESLint (`no-explicit-any`, `no-unsafe-*`,
  `no-non-null-assertion`, toutes en erreur) dans le hook `pre-commit` et
  la CI.

## Accès aux données — jamais `PrismaService` directement dans un service

Voir `docs/backend/adr/0003-pattern-repository-port-adapter.md`. Un
service métier injecte `@Inject(<DOMAINE>_REPOSITORY) private readonly
repo: I<Domaine>Repository`, jamais `PrismaService`. Seule la classe
`Prisma<Domaine>Repository` du module importe `PrismaService`.

## Taille et complexité des fichiers

- **Seuil de conception : 400 lignes par fichier** (`max-lines`,
  `skipComments: true`, `warn` — pas `error` tant que la baseline n'est
  pas vidée). Un fichier qui franchit ce seuil porte le plus souvent plus
  d'une responsabilité.
- Règles complémentaires, même logique, toutes en `warn` :
  `max-lines-per-function` (80), `max-depth` (4), `complexity` (15).
- **Exclu** : `*.spec.ts`, `test/**/*.ts`, `*.dto.ts`.
- **Ne pas relever le seuil pour faire taire l'avertissement** — découper,
  ou ouvrir un ticket dédié.

## Contrat de réponse HTTP

- Toute réponse succès passe par `ResponseInterceptor` :
  `{ success: true, data, meta }`. Une liste paginée : `data` = items,
  `meta` = `{ page, limit, total, totalPages }`.
- Toute erreur passe par `AllExceptionsFilter` :
  `{ success: false, error: { statusCode, message, error, path, timestamp } }`.
- `message` peut être une chaîne ou un tableau (validation
  `class-validator`). Les 5xx inattendues renvoient toujours un message
  générique, jamais de fuite de stack.
- Ne jamais inventer un format de liste/pagination dans un module — voir
  `PaginationQueryDto` (`page` défaut 1, `limit` défaut 20 max 100,
  `sortBy`/`sortOrder`).

## Swagger

- Tout nouveau DTO naît avec ses décorateurs (`@ApiProperty()` /
  `@ApiPropertyOptional()`) dès sa création.
- Routes protégées par JWT : `@ApiBearerAuth()`.

## Multi-tenant et paiements

Voir `docs/backend/multi-tenant.md` et `docs/backend/paiements-djomy.md` —
deux documents dédiés plutôt qu'une section ici, parce que ce sont les deux
surfaces de risque les plus élevées du projet et qu'elles méritent des
exemples de code complets, pas un résumé.

## Secrets et configuration

- Jamais de secret, clé Djomy, mot de passe ou token en dur dans le code,
  les migrations ou les fichiers de config commités.
- Ne jamais lire, logger ou citer le contenu d'un fichier `.env`.
- `.env.example` (versionné, jamais de valeur sensible) liste les noms de
  variables attendues.

## Tests

- Tout changement de logique métier est accompagné de tests unitaires a
  minima, y compris en phase bootstrap — pas d'exception le temps que le
  reste du projet démarre.
- Un repository se teste en mockant l'interface (`I<Domaine>Repository`)
  pour le service, ou en intégration contre une base de test pour
  l'implémentation Prisma elle-même.
- **Isolation multi-tenant et écritures financières ont un test dédié dès
  leur premier module** — voir les gabarits dans `docs/backend/multi-tenant.md`
  et `docs/backend/paiements-djomy.md`.

## Workflow Git

Voir `docs/backend/workflow.md`.

## Environnement local

- Fixer la version de Node exacte dans `.nvmrc` (pas seulement la
  majeure) + `engines`/`engine-strict` dans `package.json`/`.npmrc` — un
  écart de version mineure peut produire un `package-lock.json`
  incompatible entre postes et CI (leçon tirée de smartsms-backend :
  binaires WASM optionnels différents d'une mineure Node à l'autre).
- Un seul gestionnaire de paquets par dépôt (`npm` **ou** `pnpm`, pas les
  deux) — un deuxième lock file fait diverger l'arbre de dépendances
  installé selon la commande utilisée.
