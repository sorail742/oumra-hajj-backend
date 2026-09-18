# ADR-0002 — Isolation multi-tenant par `organizationId`

## Statut

Proposé

## Contexte

Le cahier des charges (§4, §6.2, §6.4) exige une isolation stricte des
données entre organisations (propriétaires/agences) : "chaque organisation
dispose d'un espace cloisonné... invisibles des autres organisations". Il
identifie lui-même ce point comme le risque le plus élevé du projet (§12.2,
"Complexité du multi-tenant sous-estimée → Risque de fuite de données entre
organisations").

`smartsms-backend` a déjà ce même profil (SaaS multi-tenant, `clientId` sur
chaque table métier) et documente une leçon directement transposable :
sans mécanisme de vérification automatique, un oubli de filtre passe la
revue humaine — trois occurrences réelles corrigées après coup (issues #86,
#91, #93 de ce projet frère).

## Décision

**Isolation au niveau applicatif, par `organizationId` sur chaque table
métier**, contrôlée par trois mécanismes complémentaires — pas un seul :

1. **`AuthenticatedUser` résolu une fois** par requête HTTP (`JwtStrategy`),
   jamais rechargé depuis la base par un service.
2. **Chaque repository filtre explicitement par `organizationId`** sur
   toute requête Prisma touchant une table tenant-scopée.
3. **Une règle ESLint personnalisée**
   (`darmeuble/require-organization-id-filter`, répliquée de
   `smartsms/require-client-id-filter`) signale toute requête sur une table
   de la liste `TENANT_SCOPED_MODELS` dont le `where` ne contient pas la
   clef de scoping.

Voir `docs/backend/multi-tenant.md` pour le détail complet, y compris la
portée intra-organisation additionnelle du rôle `manager` (gestionnaire
délégué, limité à ses immeubles assignés).

## Justification

**Pourquoi une règle ESLint et pas seulement la revue humaine.** C'est
précisément le constat de smartsms-backend : la revue humaine seule a
laissé passer trois oublis avant qu'une règle automatique existe. Le coût
d'écriture de la règle (quelques heures) est sans commune mesure avec le
coût d'une fuite de données entre deux organisations clientes payantes.

**Pourquoi ne pas utiliser Row-Level Security (RLS) PostgreSQL à la
place.** Envisageable, mais plus complexe à opérer avec Prisma (pas de
support natif des politiques RLS dans le client généré) et moins visible en
revue de code qu'un filtre explicite dans chaque repository — un
compromis pertinent pour une équipe qui débute le projet, à reconsidérer
si le nombre de tables tenant-scopées devient difficile à auditer
manuellement.

## Conséquences

- Tout nouveau modèle métier ajouté au schéma Prisma doit être ajouté à
  `TENANT_SCOPED_MODELS` (`eslint.config.mjs`) dans la même MR — sinon il
  n'est pas contrôlé, ce qui est un trou volontaire mais qui doit être
  fermé immédiatement, pas laissé ouvert.
- Tests d'isolation dédiés dès la Phase 1 (voir
  `docs/backend/socle-backend.md` §9 et le gabarit dans
  `docs/backend/multi-tenant.md`).
- Le `super_admin` (sans `organizationId`, cahier des charges §4) a besoin
  de requêtes transverses légitimes — traitées par l'échappatoire
  `eslint-disable` documentée, jamais par une exception silencieuse dans
  la règle elle-même.

## Alternatives écartées

**Une base de données par organisation (isolation physique).** Écarté :
coût opérationnel disproportionné à ce stade (migrations, sauvegardes,
connexions multipliées par le nombre d'organisations), pour un besoin que
l'isolation applicative satisfait déjà au niveau d'exigence du cahier des
charges.

**Row-Level Security PostgreSQL.** Voir §Justification ci-dessus —
pertinent à reconsidérer, pas retenu au démarrage.
