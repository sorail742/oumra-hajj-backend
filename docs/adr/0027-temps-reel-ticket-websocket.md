# 0027 — Temps réel : ticket WebSocket éphémère

- **Statut** : accepté
- **Date** : 2026-10-06
- **Décideurs** : Sory KEITA (option B retenue explicitement le 2026-10-06)
- **Complète** : [0014 — Messagerie agence/guide](0014-messagerie-agence-guide.md), [0023 — Communauté pré-départ](0023-communaute-pre-depart-chat-groupe.md) ; ADR jumeau côté web : ADR-0006 (`oumra-hajj-web`)

## Contexte

Les gateways Socket.IO `messaging` et `community` authentifiaient le
handshake avec l'access token. Le web ne peut pas le fournir : il reste
dans un cookie `httpOnly` (ADR-0002 du web), hors de portée d'un script de
page. Le web est hébergé sur Vercel, qui ne relaie pas de WebSocket
(ADR 0024) : un proxy WebSocket côté web est exclu.

## Décision

1. **`POST /auth/realtime-ticket`** (authentifié, 20 par minute) renvoie
   `{ ticket, expiresAt }` : JWT signé avec **`REALTIME_TICKET_SECRET`**
   (distinct des secrets JWT), audience `ws`, durée **30 s**, `jti` **à
   usage unique**. Il ne porte que `sub` et `role`.
2. **Handshake** : `auth.ticket` (web) **ou** l'access token (`auth.token`
   / en-tête `Authorization`, application mobile, qui le détient hors de
   portée d'un script de page). Contrôles d'accès des rooms inchangés.
3. **Sessions** : chaque connexion est fermée au bout de **15 min** (le
   client se reconnecte avec un ticket neuf) et toutes celles d'un
   utilisateur à `POST /auth/logout`.
4. **Diffusion** : un message envoyé en REST est aussi diffusé aux rooms
   (`message:new`, `community:new`). Le web envoie en REST et n'écoute que
   les évènements ; la liste reste lue en REST.
5. **Production sans `REALTIME_TICKET_SECRET`** : aucun ticket émis (`503`)
   ni accepté ; le web retombe sur le rafraîchissement périodique. Jamais un
   secret de développement connu.
6. **Tickets consommés gardés en mémoire** jusqu'à expiration : suffisant
   pour une instance unique (Render). À déplacer dans un stockage partagé
   si l'API passe à plusieurs instances.

## Conséquences

- Messagerie et discussion de groupe instantanées sur le web, sans exposer
  l'access token.
- Nouvelle variable d'environnement sur Render : `REALTIME_TICKET_SECRET`
  (chaîne aléatoire longue, différente des secrets JWT).
- Dépendance de test `socket.io-client` (version épinglée) pour le test e2e
  du handshake.
