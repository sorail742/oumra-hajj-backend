# Workflow Git — oumra-hadj-web

**Ce document diverge délibérément de celui de `smartsms-frontend`.** Leur
`docs/workflow.md` documente un flux GitLab complet (Merge Request
obligatoire, push vers un remote, labels `workflow::`) parce que leur dépôt
a un remote GitLab réel et une équipe de plusieurs personnes qui y
collaborent. `oumra-hadj-web` n'a, à sa création, ni l'un ni l'autre
confirmé.

## Ce qui est vrai aujourd'hui

`oumra-hadj-web` suit la même convention que le backend
`Oumra-hadj-project` sur ce poste : voir son `CLAUDE.md` et son
`docs/adr/0011-conventions-git-branches.md`.

- Branche dédiée depuis `develop` : `feature/<sujet>` ou `fix/<sujet>` —
  jamais de commit direct sur `develop`/`main`.
- Développer, vérifier (`pnpm lint`, `pnpm typecheck`, `pnpm test`), puis
  merge local `--no-ff` vers `develop` une fois le travail validé.
- **Rien n'est poussé vers un remote sans demande explicite de
  l'utilisateur.** Ne pas supposer qu'un dépôt GitLab existe pour
  `oumra-hadj-web` simplement parce que le projet frère en a un — vérifier
  (`git remote -v`) avant toute action qui suppose un remote.
- Avant de créer une branche `feature/x`, vérifier qu'aucune branche du même
  nom n'existe déjà (`git branch -a | grep x`) — smartsms-frontend a connu
  des branches dupliquées entre sessions de travail successives
  (`feature/setup-husky-lint-staged` ×2, `feature/update-readme` ×2), pour
  n'avoir pas vérifié cela systématiquement. La leçon est générale, pas
  propre à leur outillage.

## Attribution des commits

**Ne pas fixer ce point dans ce document.** L'attribution (trailer
`Co-Authored-By` ou non) dépend de la convention transmise à l'agent au
moment du travail — smartsms-frontend l'interdit explicitement chez eux,
mais rien n'indique que cette règle s'applique ici. Vérifier la consigne en
vigueur avant de committer plutôt que de recopier l'interdiction d'un autre
projet.

## Quand un remote distant existera

Revoir ce document dès qu'un dépôt distant est explicitement configuré et
confirmé par l'utilisateur pour `oumra-hadj-web`. À ce moment-là, le flux
GitLab documenté par `smartsms-frontend`
(`docs/conventions-gitlab.md` et `docs/workflow.md` de leur dépôt) est une
référence directement réutilisable :

- séquence `fetch → branche → développer → push → Merge Request → revue →
  merge squash → suppression de branche` ;
- labels `workflow::` (flux de l'issue), `type::`, `prio::`, `effort::`,
  `scope::` ;
- règle de nettoyage systématique des branches après merge, pour la même
  raison qu'eux : une branche locale mergée qui traîne est une cause
  identifiée de collision de nom entre sessions.

Ne pas l'importer par anticipation : un flux de Merge Request sans dépôt
distant réel n'a rien à gouverner, et fixer des règles pour un outillage qui
n'existe pas encore invite à les appliquer de travers le jour où il existe
vraiment.

## Ce qu'un agent IA ne doit jamais faire seul sur ce dépôt

- Pousser vers un remote sans demande explicite, même si un remote est
  configuré.
- Fusionner vers `main` (réservé à la production, quelle que soit
  l'évolution du flux Git).
- Committer un fichier `.env`, un token, ou toute valeur de secret.
- Supprimer une branche contenant du travail non mergé sans en avoir signalé
  le contenu à l'utilisateur au préalable.
