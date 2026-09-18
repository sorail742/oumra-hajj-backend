# ADR-0001 — Next.js App Router comme stack frontend

## Statut

Proposé

## Contexte

Le cahier des charges impose Next.js (§6.1) sans trancher App Router vs
Pages Router. Les deux projets frères pertinents divergent : `Oumra-hadj-web`
a choisi App Router pour les mêmes raisons qui s'appliquent ici (proxy BFF
via Route Handlers, rendu serveur sur connexion lente).

## Décision

Next.js, App Router, TypeScript strict, épinglé sans `^`. Les Route
Handlers de `src/app/api/` servent de proxy entre le navigateur et le
backend NestJS.

## Justification

**Le jeton ne doit pas vivre dans `localStorage`.** DarMeuble manipule des
paiements de loyer et des données financières — l'exposition XSS d'un
jeton y a un coût élevé, comme documenté pour Oumra-hadj-web (ADR-0001 de
ce kit) et pour les mêmes raisons.

**Rendu serveur adapté à une connectivité limitée.** Le cahier des charges
(§8, "Connectivité") anticipe explicitement des connexions internet
limitées côté utilisateurs finaux (locataires notamment) — un rendu
serveur affiche du contenu avant le téléchargement complet du bundle
JavaScript.

**Alignement avec l'écosystème.** Même stack que les deux projets frères,
mêmes conventions de base.

## Conséquences

- Serveur Node requis en production (le proxy l'impose).
- Voir `docs/frontend/socle-frontend.md` pour la stack complète.

## Alternatives écartées

Identiques à celles documentées pour Oumra-hadj-web (ADR-0001 de ce kit) :
React+Vite avec BFF séparé (coût opérationnel d'un service
supplémentaire), jeton en mémoire seule (perte de session à chaque
rechargement — inacceptable pour un usage réparti sur plusieurs jours,
type suivi de dossier locatif).
