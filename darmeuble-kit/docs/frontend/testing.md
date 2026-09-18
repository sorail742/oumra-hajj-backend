# Testing — DarMeuble frontend

Vitest + Testing Library, Playwright pour l'e2e une fois un parcours
complet implémenté — même outillage qu'`oumra-hadj-web-kit`.

## Règle non négociable

Tout composant avec de la logique (appel API, état, règle métier — ex.
masquer une action selon le rôle, calculer si une échéance est en retard
côté affichage) a un test. Un composant purement présentationnel a une
story Storybook, pas un test.

## Ce qu'il faut tester en priorité, propre à DarMeuble

- `RentScheduleTracker` : le bon `StatusBadge` pour chaque combinaison de
  statut de paiement, y compris `partially_paid` — le cas le plus souvent
  oublié parce qu'il n'a pas d'équivalent binaire évident.
- `ManagerScopeIndicator`/`<Can>` : qu'un `manager` non assigné à un
  immeuble ne voit jamais d'action de gestion dessus, même si l'API
  renvoyait par erreur une donnée hors de sa portée — défense en
  profondeur côté UI, qui ne remplace pas le filtre backend
  (`docs/backend/multi-tenant.md`) mais ne doit pas non plus supposer qu'il
  est toujours correct.
- `DjomyPaymentFlow` : l'état "vérification en cours" s'affiche bien entre
  le retour de paiement et la confirmation, ne bascule jamais directement
  de "en cours" à "payé" sans passer par un statut confirmé par l'API.
- Le proxy `src/app/api/[...chemin]` : que le `Set-Cookie` du backend sur
  les routes d'authentification est bien relayé tel quel (voir
  `docs/frontend/architecture.md`), pas reconstruit.

## Tests end-to-end

Un parcours par flux clé du cahier des charges (§9), une fois implémenté :
encaisser un loyer (§9.1), payer un loyer (§9.2), signaler une panne
(§9.3).
