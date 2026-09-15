# ADR-0001 — Next.js App Router comme stack frontend

## Statut

Proposé

## Contexte

`oumra-hadj-web` démarre de zéro : contrairement à `smartsms-frontend`, il
n'y a pas de stack antérieure (React + Vite) à migrer — l'occasion de
choisir directement la cible plutôt que de payer une migration plus tard.

Trois contraintes, connues dès le départ grâce au backend déjà construit
(`Oumra-hadj-project`) :

**Le jeton ne doit pas vivre dans `localStorage`.** Les documents pèlerins
(passeport, visa) et les données de paiement transitent par ce frontend —
l'exposition XSS d'un jeton de session y a un coût plus élevé que sur une
console de campagnes SMS.

**Le contrat API est jeune.** Pas d'enveloppe de réponse unifiée, pas de
pagination serveur, pas de code d'erreur métier stable (voir
`docs/contrat-api.md`). Un point de passage serveur permet de normaliser
ces aspérités à un seul endroit plutôt qu'à chaque appel.

**Le rendu doit rester utilisable sur un réseau lent.** Le public pèlerin
consulte son dossier depuis un téléphone, souvent en dehors d'un réseau
fixe. Un rendu serveur affiche du contenu avant que le bundle JavaScript ne
soit téléchargé.

## Décision

**Next.js, App Router, TypeScript strict.** Versions épinglées sans `^` dès
l'installation — voir `docs/socle-frontend.md` §2 pour la raison.

Les Route Handlers de `src/app/api/` servent de proxy entre le navigateur et
le backend NestJS : le navigateur parle à Next, Next parle au backend en
ajoutant l'en-tête `Authorization` lu dans un cookie `httpOnly`.

## Justification

**Aucun coût de migration** : contrairement à `smartsms-frontend`, ce choix
n'annule aucun code existant.

**App Router plutôt que Pages Router** : direction actuelle du framework,
Server Components réduisent le JavaScript envoyé au navigateur.

**Alignement avec un projet frère déjà en production.** `smartsms-frontend`
a traversé les mêmes choix (voir son ADR-0004) sur le même écosystème
(même équipe, même infrastructure de déploiement potentielle) — repartir
sur une stack différente sans raison propre à ce projet ajouterait une
charge d'apprentissage sans bénéfice identifié.

## Conséquences

### Ce que cela impose

- Un **serveur Node en production**, pas des fichiers statiques — les Route
  Handlers doivent s'exécuter pour que le jeton reste hors du navigateur.
- TypeScript strict dès le premier fichier (`docs/coding-rules-frontend.md`).

### Ce qui reste à trancher séparément

- L'infrastructure de déploiement réelle (aucune décision prise dans cet
  ADR — à documenter dans un ADR dédié une fois choisie).
- Le pipeline CI/CD.

## Alternatives écartées

**React + Vite avec un BFF séparé.** Répond au même besoin de proxy, mais
ajoute un service distinct à déployer et à maintenir. Next fait les deux
dans une seule application — même arbitrage que documenté par
smartsms-frontend (ADR-0004), qui s'applique telle quelle ici.

**Stocker le jeton en mémoire côté client (sans proxy).** Le jeton disparaît
à chaque rechargement de page — inacceptable pour un pèlerin qui consulte
son dossier plusieurs fois par jour sur plusieurs sessions.
