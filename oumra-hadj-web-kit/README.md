# Kit de démarrage — oumra-hadj-web

Ce dossier contient **tout ce qu'il faut pour démarrer `oumra-hadj-web`** (le
futur frontend Next.js de la plateforme Oumra/Hadj) sur des bases saines,
sans redécouvrir en cours de route des règles déjà tranchées par un projet
sœur.

## D'où vient ce kit

Élaboré en lisant en détail (lecture seule, rien modifié) le dépôt
`smartsms-frontend` — un frontend Next.js déjà construit, avec 8
développeurs, une pile technique moderne et une documentation processuelle
très mûre (ADR, socle, design system, contrat API, workflow Git). Ce projet a
déjà traversé les problèmes qu'`oumra-hadj-web` va rencontrer : jeton
d'authentification mal stocké, contrat API incomplet, composants dupliqués,
branches en doublon entre sessions de travail.

**Rien n'a été copié-collé aveuglément.** Chaque règle a été confrontée aux
faits réels de *notre* backend (`Oumra-hadj-project`, NestJS/Prisma/PostgreSQL,
`openapi.json` à la racine) avant d'être reprise, adaptée, ou explicitement
écartée. Voir `docs/contrat-api.md` et `docs/architecture.md` pour le détail
des écarts constatés — ils sont documentés, pas devinés.

## Ce qui est repris tel quel (les mêmes faits s'appliquent)

- Le proxy Next.js (Route Handlers) + cookie `httpOnly` pour ne jamais
  exposer le jeton au JavaScript de la page — le raisonnement d'ADR-0004/0005
  de smartsms-frontend s'applique mot pour mot ici.
- La règle `features/x` n'importe jamais `features/y`, appliquée par ESLint,
  pas par la discipline.
- Le principe des quatre états (chargement/vide/erreur/nominal) outillés par
  un composant unique, pas réimplémentés écran par écran.
- Le principe d'un registre unique de statuts (`<StatusBadge>` + un fichier),
  d'une fabrique unique de clés TanStack Query, d'un formatage centralisé.
- GNF comme devise et le Guinée comme contexte régional probable (à
  confirmer — voir `docs/contrat-api.md`) : le formatage de montants et de
  téléphones de smartsms-frontend est directement réutilisable.

## Ce qui est adapté, et pourquoi

| Sujet | smartsms-frontend | oumra-hadj-web | Pourquoi le changement |
|---|---|---|---|
| Enveloppe de réponse API | `{ success, data, meta }` uniforme (interceptor global) | Réponse brute (le DTO directement), erreurs NestJS par défaut `{ statusCode, message, error, path, timestamp }` — **aucun interceptor global côté backend actuel** | Vérifié dans `src/common/filters/http-exception.filter.ts` du backend : pas de `ResponseInterceptor`. Copier l'enveloppe de smartsms produirait un client qui lit un `data` qui n'existe pas. |
| Pagination | Enveloppe `meta.{page,limit,total,totalPages}` sur les endpoints qui paginent | **Aucune pagination côté serveur, nulle part**, à ce jour | Vérifié par lecture de tous les contrôleurs (`grep` sur `skip`/`take`/`page`) : zéro résultat. Toute liste doit être paginée côté client jusqu'à nouvel ordre. |
| Authentification | Jeton unique 7 jours, **sans** refresh (limitation backend assumée) | **Access + refresh déjà implémentés** côté backend (`POST /auth/refresh`, rotation) | Le backend Oumra-Hadj a le refresh dès aujourd'hui — le proxy Next doit donc câbler la file d'attente de requêtes concurrentes que smartsms-frontend documente explicitement comme *à ne pas faire* (chez eux, ce serait du code mort ; chez nous, ce serait un renouvellement silencieux qui marche). |
| Rôles et permissions | 8 rôles, matrice de 38 permissions booléennes (`GET /api/me`) | **4 rôles plats** (`pilgrim`, `agency`, `guide`, `admin`), pas de matrice de permissions | `src/common/enums/role.enum.ts` du backend. `<Can>` devient une garde par rôle, pas par permission fine — inutile de reconstruire une matrice qui n'existe pas côté API. |
| Registre de statuts | ~70 enums API | **9 enums** aujourd'hui (`BookingStatus`, `PaymentStatus`, `PilgrimDocumentStatus`, `AgencyValidationStatus`, `PackageStatus`, `DossierStepStatus`, `DossierStepKey`, `PilgrimageType`, `NotificationType`) | Le principe (un seul registre, jamais un mapping par écran) s'applique dès le premier enum, pas seulement à 70. |
| Identité visuelle | Indigo `oklch(0.52 0.2 268)`, Inter + JetBrains Mono | Sage/vert profond + or, Source Sans 3 + IBM Plex Mono | Continuité avec l'identité déjà utilisée pour les documents "Parcours Pèlerin" et "Cent Fonctionnalités" publiés à l'utilisateur cette même nuit — un produit de pèlerinage n'a pas la même charge visuelle qu'une console SaaS de campagnes SMS. |
| Contenu religieux | Sans objet | **Obligatoire** : tout contenu de rite/Dua affiché doit porter un indicateur « à valider par une personne qualifiée » tant qu'il n'a pas reçu de validation explicite | Contrainte explicite de `CLAUDE.md` (backend), qui doit se prolonger côté UI — sans quoi la validation existe en base mais jamais à l'écran. |
| Workflow Git | Flux GitLab complet : MR obligatoire, push vers un remote, labels `workflow::`/`type::`/`prio::` | Branches locales dédiées, merge `--no-ff` local, **rien poussé vers un remote sauf demande explicite** | C'est la convention déjà en vigueur sur `Oumra-hadj-project` (voir `CLAUDE.md` et ADR 0011 du backend) — `oumra-hadj-web` n'a pas de dépôt GitLab distant à ce jour, inventer un flux MR serait prématuré. |
| Vocabulaire à deux sens | « segment » = audience **et** unité de facturation SMS | Pas d'ambiguïté connue dans le domaine pèlerinage | Section retirée — rien à documenter qui n'existe pas. |

## Comment utiliser ce kit

1. Lire `CLAUDE.md` en premier — c'est le document condensé destiné à un
   assistant IA (ou un humain pressé) travaillant sur `oumra-hadj-web`.
2. Lire `docs/socle-frontend.md` en entier avant d'écrire la première ligne
   de code — en particulier son §0 (décisions actées).
3. Copier `config-templates/` à la racine du nouveau dépôt une fois
   `pnpm create next-app` exécuté (voir `docs/socle-frontend.md` §10 pour la
   commande exacte).
4. Copier `code-templates/` dans `src/` du nouveau dépôt — ce sont des
   fichiers de départ fonctionnels (proxy, client API, cookie de session,
   formatage), pas des exemples à retaper.
5. Regénérer `openapi.json` côté backend (`npm run openapi:export` dans
   `Oumra-hadj-project`) et le copier à la racine du nouveau dépôt **avant**
   de lancer `openapi-typescript` — voir `docs/contrat-api.md`.

## Ce que ce kit ne contient pas (délibérément)

- **Aucun écran, aucun composant métier.** Ce socle décide la stack,
  l'arborescence, les tokens, l'API des composants transverses et les
  conventions — pas le code des écrans. C'est le travail de l'équipe qui
  construira `oumra-hadj-web`, exactement comme `socle-frontend.md` de
  smartsms le formule pour son propre projet.
- **Aucune valeur de secret.** `.env.example` du kit ne contient que des
  noms de variables, jamais de valeur — voir `docs/secrets-management.md`
  du backend pour la règle déjà en vigueur sur ce dépôt.
- **Aucun agent `.claude/` copié.** smartsms-frontend définit deux agents
  (`revue-mr`, `audit-qualite`) invocables par Claude Code. Utiles une fois
  qu'il y a du code réel à relire — à recréer quand `oumra-hadj-web` aura
  quelques écrans, pas avant.
