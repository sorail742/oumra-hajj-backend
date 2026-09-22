# Coding rules — oumra-hadj-web

Règles concrètes, consolidées à partir des ADR (`docs/adr/`) et du socle
(`docs/socle-frontend.md`). Destiné à tout contributeur, humain ou agent.

## État du projet — à vérifier avant toute tâche

Tant que le scaffold Next.js n'existe pas encore (`next.config.ts`,
`tsconfig.json`, `src/app/`), toute règle ci-dessous est **une décision
prise par avance**, pas la description d'un code existant. Vérifier l'état
réel du dépôt avant de supposer qu'une structure est en place — même mise en
garde que `smartsms-frontend` formule pour son propre bootstrap, et pour la
même raison : une session de travail qui suppose au lieu de vérifier
reproduit du travail déjà fait ou en contredit un autre en cours.

## Typage strict — dès le premier fichier, sans exception

Au moment de créer `tsconfig.json` : `strict: true`, `noImplicitAny: true`,
`strictNullChecks: true`, `noUncheckedIndexedAccess: true` — voir
`config-templates/tsconfig.json`, prêt à copier. Mêmes réglages que côté
backend (`Oumra-hadj-project`, TypeScript strict partout).

- **`any` interdit, sous toute forme** — ni déclaration explicite, ni
  implicite, ni contournement (`as any`, `@ts-ignore` sans justification
  écrite validée en revue).
- **Aucun accès à une valeur potentiellement `undefined`/`null` sans
  contrôle explicite** — props optionnelles, réponses API, résultats de
  recherche dans un tableau.
- ESLint intégré à `lint-staged` dès l'import du scaffold, avec
  `@typescript-eslint/no-explicit-any` en erreur — voir
  `config-templates/eslint.config.mjs`.

## Authentification et API

- Le jeton vit dans un cookie `httpOnly` posé par les Route Handlers de
  Next — jamais dans `localStorage`, jamais dans l'en-tête `Authorization`
  émis directement par un composant.
- Le client HTTP centralisé (`lib/api/client.ts`) est le seul point d'appel
  API — ne pas dupliquer des appels `fetch` ailleurs dans les composants.
- **Le proxy est le seul endroit qui parle au backend directement** (avec le
  flux calendrier ICS comme unique exception documentée, voir
  `docs/contrat-api.md`).
- L'UI reflète le rôle réel de l'utilisateur via `<Can>`, mais **le backend
  reste la seule source de vérité de sécurité** — un contournement
  client-side d'une garde `<Can>` ne doit jamais donner accès à une donnée
  que le backend refuserait.

## Secrets et configuration

- Jamais de secret, clé API ou token en dur dans le code.
- Ne jamais lire, logger ou citer le contenu d'un fichier `.env` dans une
  réponse, un commit ou une documentation.
- `BACKEND_URL` est une variable serveur, **sans** préfixe `NEXT_PUBLIC_` —
  elle ne doit jamais apparaître dans le bundle envoyé au navigateur.
- Variables documentées (sans valeurs) dans `.env.example`.

## Données sensibles — au-delà de la règle générique

Les documents pèlerins (passeport, visa, certificat de vaccination) sont des
pièces d'identité, pas de la donnée produit ordinaire :

- ne jamais mettre en cache une image de document au-delà de sa
  consultation à l'écran (pas de `<img>` avec un `src` persistant vers une
  URL signée réutilisée après expiration, pas de stockage en
  `IndexedDB`/`localStorage`) ;
- ne jamais journaliser (`console.log`, un outil de suivi d'erreurs client)
  le contenu d'un document ou une donnée de paiement ;
- toute fonctionnalité touchant aux documents, aux paiements ou au bouton
  SOS nécessite un test avant merge — même exigence que côté backend
  (`CLAUDE.md`), transposée côté frontend : un test qui vérifie que le
  composant affiche bien le bon `StatusBadge`/la bonne action selon le rôle
  et le statut.

## Git — voir `docs/workflow.md`

Ce fichier ne fixe pas le flux Git : il vit dans `docs/workflow.md`, parce
que ce point dépend d'une décision qui n'est pas encore prise pour ce dépôt
(existence d'un remote distant) — voir `CLAUDE.md` de ce kit.

## Environnement local

- Node.js LTS et **pnpm** — pas de second gestionnaire de paquets. Un
  `package-lock.json` en plus du `pnpm-lock.yaml` fait diverger l'arbre de
  dépendances installé selon la commande utilisée.
- **Jamais `npm install`** une fois `pnpm-lock.yaml` commité.
