# 0014 — Messagerie pèlerin ↔ agence/guide

- **Statut** : proposé
- **Date** : 2026-09-07
- **Décideurs** : Sory KEITA — décision produit initiale prise, détails techniques à confirmer

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
direct". Les détails d'usage (participants autorisés, historique, pièces
jointes, modération) restent à préciser — voir "Questions ouvertes"
ci-dessous.

## Décision

- Nouveau module `messaging`, indépendant des modules existants — une
  conversation référence un `bookingId` (donc un pèlerin, une agence, et
  éventuellement un guide via le `groupId` de la réservation), pas l'inverse.
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

## Questions ouvertes (à trancher avant de passer ce statut à "accepté")

- **Participants** : le pèlerin peut-il écrire à un guide *et* à l'agence
  dans la même conversation, ou sont-ce deux fils séparés ? Un membre du
  groupe peut-il voir les messages des autres pèlerins au guide, ou est-ce
  strictement 1-à-1 ?
- **Historique** : durée de rétention des messages (illimitée ? purgée X mois
  après la fin du voyage, en lien avec la sensibilité des données du
  cahier des charges §8) ?
- **Pièces jointes** : texte seul au lancement, ou photo/document dès la V1 ?
  Si document, ça touche potentiellement au périmètre sensible de
  [ADR 0008](0008-stockage-documents-sensibles.md).
- **Modération** : un message signalable/modérable par l'admin (cahier des
  charges §3.4, "Modération de contenu") s'applique-t-elle à la messagerie,
  ou seulement au contenu religieux publié (fiches de rites) ?

## Conséquences

- Nouvelle dépendance (`@nestjs/websockets`, `@nestjs/platform-socket.io`,
  `socket.io`) — première brique temps réel du backend, jusqu'ici entièrement
  REST.
- Nouveau schéma Prisma (`Conversation`, `Message`) et migration SQL associée
  — à concevoir une fois les questions ouvertes ci-dessus tranchées, pas
  avant, pour éviter une deuxième migration de correction.
- Débloque l'écran "Messagerie agence/guide" côté mobile (actuellement
  marqué "bloqué" dans le document Parcours Pèlerin) et la fonctionnalité
  "Communication de masse" côté agence (cahier des charges §3.2), qui peut
  réutiliser la même infrastructure de diffusion.
- À intégrer à `docs/roadmap.md` comme étape de migration/implémentation à
  part entière une fois accepté — hors périmètre de la migration Prisma déjà
  terminée (ADR 0013), qui ne portait que sur les modules existants.
