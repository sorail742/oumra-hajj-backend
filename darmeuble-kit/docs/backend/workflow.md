# Workflow Git — DarMeuble backend

Le cahier des charges impose GitLab avec un flux par fonctionnalité et un
pipeline CI/CD (§6.5) — contrairement à `oumra-hadj-web`, dont le dépôt
distant restait à décider, DarMeuble a son hébergement déjà tranché. Ce
document décrit donc directement le flux cible, repris de
`smartsms-backend` qui applique ce modèle avec plusieurs contributeurs.

## Séquence standard

1. `git fetch --all && git branch -a` — vérifier qu'aucune branche du même
   nom n'existe déjà (des collisions se sont déjà produites sur les deux
   projets sources, toujours pour la même raison : une session de travail
   qui n'a pas vérifié avant de créer).
2. Créer la branche depuis l'issue GitLab correspondante (`feature/12-gestion-baux`,
   selon la convention du cahier des charges §6.5) — depuis `develop`,
   jamais depuis `main`.
3. Développer, committer par sujet logique.
4. Push sur la branche `feature/*` uniquement — **jamais push ni merge
   direct sur `develop`/`main`**, protégées, réservées au rôle habilité à
   fusionner.
5. Ouvrir la Merge Request vers `develop` — seulement si l'utilisateur le
   demande explicitement pour cette MR précise, jamais de façon routinière.
6. Pipeline CI : lint (ESLint + `tsc --noEmit` + règles personnalisées
   `darmeuble/*`) → tests → build.
7. Une approbation minimum + discussions résolues + pipeline vert avant
   merge (squash).
8. Supprimer la branche locale une fois le merge confirmé.

## Ce qu'un agent IA ne doit jamais faire seul sur ce dépôt

- Push ou merge direct sur `develop`/`main`.
- Approuver ou fusionner une Merge Request à la place d'un humain.
- Contourner le hook `pre-commit` (`--no-verify`) sans accord explicite.
- Committer un fichier `.env`, une clé Djomy, ou toute valeur de secret.
- Ouvrir une MR sans demande explicite pour cette MR précise.

## Attribution des commits

**Ne pas fixer ce point par défaut.** smartsms-backend interdit
explicitement tout trailer `Co-Authored-By` ou mention d'outil de
génération dans un commit ou une description de MR — vérifier si la même
convention s'applique à DarMeuble avant de committer, plutôt que de la
supposer dans un sens ou dans l'autre.

## Avant qu'un dépôt distant existe réellement

Tant que le dépôt GitLab de DarMeuble n'est pas encore créé : branches
locales dédiées, merges locaux `--no-ff` une fois le travail vérifié
(lint, typecheck, tests), rien poussé vers un remote qui n'existe pas
encore — vérifier (`git remote -v`) plutôt que supposer.
