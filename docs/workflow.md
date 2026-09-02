# Workflow Git & issues

Référence : [ADR 0011](adr/0011-conventions-git-branches.md) (accepté). Ce
document décrit comment ça se passe concrètement sur ce dépôt GitLab.

## Règle d'or

**Une fonctionnalité = une branche.** Jamais de commit direct sur `develop`
ou `main` — `develop` est protégée côté GitLab (push direct refusé, y compris
pour les Maintainers) : tout changement passe par une Merge Request.

## Cycle de vie d'un ticket

1. **Issue** créée dans GitLab, avec :
   - un **Contexte** (référence au cahier des charges et/ou à l'ADR concerné) ;
   - des **critères d'acceptation** (ce qui doit être vrai une fois fini) ;
   - une **checklist de validation** (implémentation, tests, lint/build, revue,
     fusion) — voir les issues déjà créées comme gabarit.
2. **Branche** créée depuis `develop`, nommée `feature/<numéro-issue>-<titre-court>`
   ou `fix/<numéro-issue>-<titre-court>` (ex. `feature/13-prisma-users`).
3. **Développement** : commits courts et explicites, à l'impératif présent,
   esprit Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`,
   `ci:`) sans outillage automatisé imposé.
4. **Vérification locale** avant de pousser : `npm run lint`, `npm run test`,
   `npm run test:e2e`, `npm run build` — tous verts (voir `testing.md`).
5. **Push** de la branche, **Merge Request** ouverte vers `develop`, avec un
   résumé quoi/pourquoi/comment tester (voir `CONTRIBUTING.md`).
6. **Pipeline CI** verte (lint, tests, build — voir `devops.md`).
7. **Merge** dans `develop` (par un Maintainer), branche source supprimée.
8. **Issue fermée** une fois le changement fusionné et vérifié.

## `develop` → `main`

`main` ne reflète que la production. Le passage `develop` → `main` se fait
par une Merge Request dédiée, au moment d'une mise en production (voir
`devops.md`), jamais en continu à chaque fusion sur `develop`.

## Migration Prisma en cours (ADR 0013)

Chaque module migré de Mongoose vers Prisma suit ce même cycle, un module à
la fois — voir l'ordre retenu dans `roadmap.md`. Ne pas migrer deux modules
dans la même Merge Request : ça complique la revue et le retour arrière si
un module pose problème.

## ADR

Un ADR par décision structurante — voir `docs/adr/README.md` pour la liste
et la procédure de création. Statuts : `proposé` → `accepté` (jamais
réécrit une fois accepté ; un changement crée un nouvel ADR qui `remplace`
l'ancien, voir ADR 0013 comme exemple concret de ce mécanisme).
