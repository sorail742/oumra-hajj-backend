# Testing — DarMeuble backend

Jest (unitaire + e2e), même outillage que les deux projets sources.

## Règle non négociable

Tout changement de logique métier est accompagné de tests, y compris en
phase bootstrap — pas d'exception le temps que le reste du projet démarre
(même exigence que smartsms-backend, ADR-0008 de ce projet frère).

## Un test doit pouvoir échouer

Avant de considérer un test terminé, casser volontairement le code qu'il
couvre et vérifier qu'il échoue. Un test qui passe quoi qu'on fasse au code
donne une fausse assurance.

## Ce qu'il faut tester en priorité

Les branches où l'erreur coûte cher, pas le chemin nominal — voir
`docs/backend/multi-tenant.md` et `docs/backend/paiements-djomy.md` pour
les gabarits complets :

- **Isolation multi-tenant** : une requête pour l'organisation A ne
  renvoie jamais de données de l'organisation B, sur chaque table
  tenant-scopée, dès son premier module.
- **Confirmation de paiement concurrente** : deux appels simultanés au
  webhook Djomy (ou à la réconciliation périodique) sur le même paiement
  ne créditent qu'une fois — c'est l'exigence derrière la règle
  `darmeuble/require-status-condition-on-write`.
- **Portée du gestionnaire délégué** : un `manager` non assigné à un
  immeuble ne peut ni le lire ni le modifier, même au sein de sa propre
  organisation.
- **Rotation de refresh token** : un token déjà utilisé une fois est
  rejeté, et sa réutilisation détectée révoque la session entière — pas
  seulement la requête en cours.
- **Calcul des pénalités de retard et de la répartition des charges** —
  logique métier propre à DarMeuble, sans équivalent dans les deux projets
  sources : à spécifier précisément avec le porteur produit avant
  d'écrire le test, la formule exacte n'est pas dans le cahier des charges.

## Ce qu'on ne teste pas

- Le rendu exact d'un DTO (les décorateurs Swagger suffisent à documenter
  sa forme).
- Les bibliothèques tierces (Prisma, Passport, `@nestjs/*`).

## Tests end-to-end

Un parcours e2e par flux clé du cahier des charges (§9) une fois le
parcours complet implémenté : encaisser un loyer (§9.1), payer un loyer en
tant que locataire (§9.2), signaler une panne (§9.3). Les monter avant que
le parcours existe reviendrait à tester un flux qui change encore à chaque
itération.

## CI

Le job `lint` enchaîne les règles ESLint personnalisées
(`darmeuble/require-organization-id-filter`,
`darmeuble/require-status-condition-on-write`) avant ESLint générique —
même câblage que smartsms-backend (`npm run lint` les inclut, rien à
ajouter dans `.gitlab-ci.yml` au-delà du template partagé).
