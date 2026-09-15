# Testing — oumra-hadj-web

Vitest (jsdom + Testing Library) pour l'unitaire/composant, Playwright pour
l'e2e une fois qu'un parcours complet existe. Storybook sert de catalogue et
de vérification d'accessibilité au niveau du composant.

```bash
pnpm test            # une passe
pnpm test:watch       # en continu
pnpm test:coverage    # avec rapport de couverture
```

## Règle non négociable

**Tout composant avec de la logique doit avoir un test.** Un composant qui
appelle l'API, gère un état, ou applique une règle métier — masquer une
action selon un rôle, calculer le pourcentage d'un remboursement, afficher
l'indicateur de contenu religieux selon un flag — doit être testé.

Un composant purement présentationnel n'en a pas besoin : sa story
Storybook suffit.

## Un test doit pouvoir échouer

Avant de considérer un test terminé, **casser volontairement le code qu'il
couvre et vérifier qu'il échoue**. Un test qui passe quoi qu'on fasse au
code donne une fausse assurance.

## Ce qu'il faut tester en priorité

Les branches où l'erreur coûte cher, pas le chemin nominal :

- Le calcul du barème de remboursement affiché par `RefundRequestFlow` —
  un pourcentage faux affiché au pèlerin avant confirmation est pire qu'une
  absence d'affichage.
- Le proxy `src/app/api/[...chemin]` : que le cookie ne soit **jamais**
  transmis au backend, et que le renouvellement de jeton (refresh) mette
  bien en file les requêtes concurrentes plutôt que de déclencher n
  appels à `/auth/refresh` en parallèle.
- `<Can>` : qu'un rôle absent de la liste requise masque bien l'action, et
  qu'aucune donnée (`droits` indéfini) se traduit par un refus, jamais un
  accès par défaut.
- `ReligiousContentNotice` : qu'elle s'affiche bien tant que `validated` est
  `false`, et qu'aucun chemin de code ne peut la faire disparaître sans que
  le backend confirme la validation.
- Les quatre états d'un écran de données : chargement, vide, erreur,
  nominal.

## Ce qu'on ne teste pas

- Le rendu exact d'un composant présentationnel — sa story Storybook le
  documente mieux qu'une assertion sur du HTML.
- Les bibliothèques tierces : TanStack Query, Radix, Next sont testés chez
  eux.
- Les valeurs de style : elles viennent des tokens, un test qui les fige
  empêcherait de faire évoluer le design system.

## Tests end-to-end

Pas avant qu'un parcours complet existe (connexion pèlerin par OTP, ou
connexion agence, suivie d'un écran réel). Les monter avant reviendrait à
tester un parcours qui change encore à chaque itération — même
raisonnement que `smartsms-frontend`.

## CI

Une fois un pipeline en place : `lint` → `test` (avec couverture) → `build`,
vérifié en local avant de pousser (`pnpm lint && pnpm typecheck && pnpm test
&& pnpm build`) pour éviter un aller-retour. Vérifier explicitement la
syntaxe de transmission des flags à `vitest` selon le gestionnaire de
paquets utilisé — un piège documenté côté smartsms-frontend
(`pnpm run test -- --coverage` ne transmet pas le flag, contrairement à
npm) peut se reproduire avec n'importe quel outil qui traite `--` littéralement.
