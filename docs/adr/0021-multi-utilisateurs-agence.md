# 0021 — Multi-utilisateurs par agence (rôles internes)

- **Statut** : proposé
- **Date** : 2026-09-13

## Contexte

Idée #44 du brainstorm "Cent Fonctionnalités". Aujourd'hui, `Agency.ownerId`
pointe vers un unique `User` (rôle global `AGENCY`) — c'est ce compte, et lui
seul, qui a accès à tout le périmètre agence (forfaits, réservations,
documents légaux, paiements, remboursements...). Chaque service qui résout
"l'agence courante" le fait via `AgenciesService.findByOwnerOrFail(user.sub)`
(`agencies.service.ts`, et par extension `documents.service.ts`,
`payments.service.ts`, `bookings.service.ts`, `packages.service.ts`,
`reviews.service.ts`), ce qui suppose une relation 1:1 entre utilisateur et
agence.

L'idée #44 demande des rôles internes différenciés (comptable, commercial,
opérations) pour qu'une agence à plusieurs employés n'ait plus à partager un
seul compte/mot de passe. Cela touche directement le modèle d'autorisation
tranché par l'ADR 0003 (accepté) : ADR 0003 définit un modèle plat à quatre
rôles globaux (pèlerin, guide, agence, admin) vérifiés par `RolesGuard` — il
ne prévoit pas de sous-rôles à l'intérieur d'un rôle. Conformément à
`CLAUDE.md` ("ne jamais changer un choix déjà tranché par un ADR accepté sans
en créer un nouveau qui le remplace"), cette extension doit passer par un
nouvel ADR plutôt que par une modification silencieuse du code
d'autorisation.

## Décision proposée (à valider)

- Nouveau modèle `AgencyMember` (agenceId, userId, sous-rôle) en complément
  de `Agency.ownerId` plutôt qu'à sa place — `ownerId` reste le premier
  membre, avec le sous-rôle `OWNER`, pour ne pas casser la relation
  existante ni les données déjà en base.
- Sous-rôles proposés au départ : `OWNER`, `ACCOUNTANT`, `SALES`,
  `OPERATIONS` — périmètre de chacun à préciser idée par idée (ex. un
  `ACCOUNTANT` voit les paiements/remboursements mais pas forcément les
  documents légaux d'immigration des pèlerins).
- Le rôle global JWT reste `AGENCY` pour tous les membres (aucun changement
  côté `RolesGuard`/ADR 0003) ; le sous-rôle est vérifié par une couche
  d'autorisation additionnelle, propre à cet ADR, appliquée à l'intérieur du
  périmètre agence déjà protégé.
- Toute résolution "agence courante à partir de l'utilisateur courant"
  (`findByOwnerOrFail` et équivalents) doit évoluer vers "résoudre l'agence
  et le sous-rôle du membre" — changement transverse à plusieurs modules,
  pas confiné à `AgenciesService`.

## Questions ouvertes

- Sous-rôles figés en dur (enum) au départ, ou personnalisables par
  l'agence à terme ? Un enum fixe est nettement plus simple et suffit
  probablement pour une première version.
- Le sous-rôle est-il embarqué dans le JWT (pas de requête DB
  supplémentaire par appel, mais désynchronisation possible tant que le
  token n'est pas rafraîchi si le rôle change) ou vérifié en base à chaque
  requête (source de vérité toujours à jour, coût d'une requête
  supplémentaire) ?
- Un utilisateur peut-il appartenir à plusieurs agences (ex. comptable
  indépendant travaillant pour plusieurs agences), ou strictement à une
  seule ? Impacte directement la forme du modèle `AgencyMember`.
- Que devient la traçabilité des actions d'un membre retiré (désactivé) —
  ses actions passées doivent-elles rester attribuables nommément ?
- Le propriétaire (`OWNER`) peut-il être remplacé/transféré, et qui peut
  ajouter/retirer des membres (seul l'`OWNER`, ou aussi l'admin plateforme
  en cas de litige) ?

## Conséquences

- Débloque #44.
- Périmètre large une fois accepté : touche `AgenciesModule` et tous les
  modules qui résolvent une agence à partir d'un utilisateur
  (`DocumentsModule`, `PaymentsModule`, `BookingsModule`, `PackagesModule`,
  `ReviewsModule`) — à traiter comme une migration progressive
  (`AgencyMember` introduit sans rien retirer, endpoints migrés un par un)
  plutôt qu'un changement unique et massif.
- Complète l'ADR 0003 sans le remplacer : le modèle de rôles globaux
  (pèlerin/guide/agence/admin) ne change pas, seul le périmètre interne au
  rôle `AGENCY` se subdivise.
