# 0023 — Communauté pré-départ : Chat & Forum de groupe en temps réel

- **Statut** : accepté
- **Date** : 2026-09-24
- **Décideurs** : Sory KEITA

## Contexte

Dans le cadre du Ticket #5 ("Communauté pré-départ" issu du brainstorm "Cent Fonctionnalités"), les pèlerins inscrits à un même groupe de voyage ont besoin d'échanger avant le départ afin de faire connaissance, poser des questions logistiques et réduire l'anxiété liée au pèlerinage.

L'ADR 0014 ("Messagerie pèlerin ↔ agence/guide") avait strictement limité la messagerie à des fils privés 1-à-1 (`agency` et `guide` par réservation), sans permettre d'espace d'échange collectif. L'utilisateur a explicitement validé le choix d'un **espace de discussion en temps réel via WebSockets** plutôt qu'un forum REST passif.

## Décision

1. **Nouveau module dédié `community`** :
   - Indépendant de `messaging`, centré sur l'entité `Group` (plutôt que sur un `bookingId` individuel).
   - Une room Socket.IO dédiée par groupe : `group:<groupId>` dans le namespace `/community`.
2. **Participants autorisés** :
   - Tout pèlerin ayant une réservation confirmée affectée à ce groupe (`GroupMember` ou réservation liée au `groupId`).
   - Le guide affecté au groupe (`Group.guideId`).
   - L'agence organisatrice (`Group.agencyId`).
   - Tout accès (connexion socket, consultation d'historique, envoi de message) fait l'objet d'une vérification stricte d'appartenance au groupe.
3. **Transport temps réel & persistance** :
   - Transport Socket.IO (`@nestjs/websockets`, `@nestjs/platform-socket.io`) réutilisant `WsJwtAuthGuard` pour l'authentification JWT sur le handshake.
   - Les messages sont persistés en base (`CommunityMessage`) avec horodatage client `clientSentAt` pour préserver l'ordre d'affichage local (conforme à l'ADR 0007).
   - Un endpoint REST (`GET /community/groups/:groupId/messages`) permet le chargement de l'historique et la reprise après déconnexion.
4. **Texte seul en V1** :
   - Aucun upload de fichier direct dans le chat.
5. **Rétention et minimisation des données** :
   - Rétention calquée sur la durée de vie du groupe / voyage, puis purge automatique post-voyage.

## Conséquences

- Extension du modèle Prisma avec `CommunityMessage` rattaché à `Group` et `User`.
- Création du `CommunityGateway` et du `CommunityService` avec tests unitaires d'autorisation rigoureux.
- Mise à jour de `docs/adr/README.md` référençant l'ADR 0023.

