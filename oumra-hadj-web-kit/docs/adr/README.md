# Architecture Decision Records — oumra-hadj-web

Registre des décisions d'architecture significatives et de leur contexte.

## Format

Un fichier par décision, `NNNN-titre-court.md`, numérotation séquentielle.
Statuts : `proposé`, `accepté`, `déprécié`, `remplacé par ADR-xxxx` — jamais
réécrit une fois accepté (ajouter une section datée plutôt que modifier le
texte existant), même convention que le backend
(`Oumra-hadj-project/docs/adr/0011-conventions-git-branches.md`).

## Index

| ADR | Titre | Statut |
| --- | --- | --- |
| [0001](0001-stack-nextjs-app-router.md) | Next.js App Router comme stack frontend | Proposé |
| [0002](0002-jeton-cookie-httponly-proxy-refresh.md) | Jeton en cookie httpOnly, proxy avec renouvellement automatique | Proposé |

Les deux sont `proposé` : elles documentent un choix déjà motivé dans ce
kit, mais n'ont pas encore été formellement validées par l'utilisateur pour
`oumra-hadj-web` — passage à `accepté` au moment où le scaffold réel est
créé sur cette base, ou remplacement par un nouvel ADR si le choix change en
route.

## Quand créer un nouvel ADR

Pour toute décision qui engage l'architecture au-delà d'un composant isolé :
choix de librairie structurante, pattern de state management, stratégie de
routing, changement de stack, nouveau service externe (paiement, SMS,
stockage). Pas nécessaire pour une décision locale à un seul composant.

Même règle que côté backend (`CLAUDE.md`) : proposer l'ADR en statut
`proposé` **avant** d'implémenter un choix structurant, plutôt que de
décider silencieusement dans le code.
