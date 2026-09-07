# 0014 — Messagerie pèlerin ↔ agence/guide

- **Statut** : accepté
- **Date** : 2026-09-07
- **Décideurs** : Sory KEITA

## Contexte

Le cahier des charges (§3.1, "Messagerie / support agence") décrit un chat
direct entre le pèlerin et l'agence ou le guide. Aucun module backend
`messaging`/`chat` n'a jamais été implémenté — seule une valeur d'enum
`NotificationType.GROUP_MESSAGE` existe, non câblée à quoi que ce soit
(voir `src/common/enums/notification-type.enum.ts`). Ce trou a été identifié
en confrontant le cahier des charges au code réel (`src/modules/`) pendant la
préparation des écrans mobiles ("Parcours Pèlerin").

L'utilisateur a tranché la question produit qui bloquait le sujet : un
**vrai chat temps réel**, pas une version minimale "contact téléphone/SMS
direct" — puis les quatre points d'usage encore ouverts (participants,
historique, pièces jointes, modération), voir "Validation" ci-dessous.

## Décision

- Nouveau module `messaging`, indépendant des modules existants — une
  conversation référence un `bookingId` (donc un pèlerin, une agence, et
  éventuellement un guide via le `groupId` de la réservation), pas l'inverse.
- **Deux fils strictement séparés et privés par réservation** : un fil
  pèlerin↔agence, un fil pèlerin↔guide — jamais fusionnés. Un pèlerin d'un
  groupe ne voit ni les fils des autres pèlerins avec le guide, ni leurs
  échanges avec l'agence. Modélisé comme deux `Conversation` par `bookingId`
  (`channel: 'agency' | 'guide'`), pas un participant supplémentaire sur une
  conversation unique.
- **Texte seul en V1** — aucune pièce jointe (photo/document). Le coffre-fort
  documents (`documents`) reste l'unique canal de fichiers ; pas de recoupement
  de périmètre avec [ADR 0008](0008-stockage-documents-sensibles.md) pour
  cette première version.
- **Pas de modération admin** sur ce canal — messagerie privée classique,
  contrairement au contenu religieux (fiches de rites) qui reste seul soumis
  à validation avant publication.
- **Rétention limitée, pas de purge à date fixe imposée par l'ADR** : les
  messages sont conservés le temps du voyage puis purgés automatiquement un
  délai après clôture du dossier (`BookingStatus.COMPLETED`) — la durée
  exacte est un paramètre de configuration (`.env`), pas une valeur figée ici,
  pour rester ajustable sans nouvel ADR.
- Transport temps réel via **Socket.IO** (`@nestjs/websockets` +
  `@nestjs/platform-socket.io`), authentifié par le même JWT access token
  que le REST (guard dédié sur le handshake, pas de session parallèle).
- Cohérent avec [ADR 0007](0007-synchronisation-hors-ligne-mobile.md)
  (hors-ligne mobile, déjà accepté) : chaque message est d'abord persisté
  côté serveur (source de vérité), diffusé en temps réel aux participants
  connectés, et reste lisible via un endpoint REST classique
  (`GET /messaging/conversations/:id/messages`) pour le mobile qui vient de
  se reconnecter après une coupure — pas de dépendance dure au socket pour
  charger l'historique.
- Un message envoyé hors-ligne côté mobile est mis en file locale
  (Hive/SQLite, même pattern que le compteur Tawaf/Sa'i) et rejoué au
  websocket dès la reconnexion, horodaté côté client pour l'ordre d'affichage
  — le serveur reste seul juge de l'ordre de persistance.
- Notification push (`NotificationType.GROUP_MESSAGE`, déjà réservé) si le
  destinataire n'est pas connecté au socket au moment de l'envoi — réutilise
  le module `notifications` existant plutôt que d'en recréer un.

## Validation

Confirmé le 2026-09-07 par Sory KEITA sur les quatre points restés ouverts :
deux fils séparés et privés (agence / guide), texte seul en V1, aucune
modération admin, rétention limitée à la durée du voyage plus un délai post
clôture (durée exacte laissée en configuration).

## Conséquences

- Nouvelle dépendance (`@nestjs/websockets`, `@nestjs/platform-socket.io`,
  `socket.io`) — première brique temps réel du backend, jusqu'ici entièrement
  REST.
- Nouveau schéma Prisma (`Conversation` avec `channel`, `Message`) et
  migration SQL associée — deux fils par réservation simplifient le modèle
  par rapport à un fil combiné multi-participants.
- Débloque l'écran "Messagerie agence/guide" côté mobile (actuellement
  marqué "bloqué" dans le document Parcours Pèlerin, à mettre à jour avec une
  navigation à deux fils) et la fonctionnalité "Communication de masse" côté
  agence (cahier des charges §3.2), qui peut réutiliser la même
  infrastructure de diffusion.
- Implémentation à suivre comme une étape à part entière de
  `docs/roadmap.md` (issue #19) — hors périmètre de la migration Prisma déjà
  terminée (ADR 0013), qui ne portait que sur les modules existants.
