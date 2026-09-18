# Workflow Git — DarMeuble frontend

Même flux que `docs/backend/workflow.md` — GitLab est imposé par le cahier
des charges (§6.5) pour les deux dépôts (backend et frontend, "un ou
plusieurs dépôts... selon préférence de l'équipe").

## Séquence standard

1. `git fetch --all && git branch -a` — vérifier qu'aucune branche du même
   nom n'existe déjà.
2. Branche `feature/*` depuis `develop`, créée depuis l'issue GitLab
   correspondante.
3. Développer, committer par sujet logique, vérifier localement
   (`lint`, `typecheck`, `test`, `build`) avant de pousser.
4. Push sur la branche `feature/*` uniquement.
5. Merge Request vers `develop` — seulement si demandée explicitement pour
   cette MR précise.
6. Pipeline vert + une approbation + discussions résolues avant merge
   (squash).

## Ce qu'un agent IA ne doit jamais faire seul

Identique à `docs/backend/workflow.md` : pas de push/merge direct sur
`develop`/`main`, pas d'approbation/merge de MR à la place d'un humain, pas
de `--no-verify` sans accord explicite, pas de secret commité.

## Avant qu'un dépôt distant existe réellement

Branches locales, merges `--no-ff` locaux, rien poussé — vérifier
(`git remote -v`) plutôt que supposer, le temps que le dépôt GitLab de
DarMeuble soit effectivement créé.
