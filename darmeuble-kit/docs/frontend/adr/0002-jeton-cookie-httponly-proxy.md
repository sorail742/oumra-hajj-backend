# ADR-0002 — Jeton en cookie httpOnly, proxy et enveloppe de réponse

## Statut

Proposé

## Contexte

Le backend DarMeuble adopte un couple access/refresh avec rotation, le
refresh étant posé **directement par le backend** (voir
`docs/backend/adr/0004-*.md`) — un choix différent de celui d'Oumra-hadj-web
(les deux cookies posés par le proxy Next). Le backend applique aussi une
enveloppe de réponse `{success,data,meta}` — différent d'Oumra-hadj-web
(réponse brute).

## Décision

**Access token** : cookie `httpOnly` + `secure` + `sameSite=lax`, posé par
le proxy Next à partir de la réponse JSON du backend (`{accessToken}` dans
`data`).

**Refresh token** : cookie `httpOnly` + `secure` + `sameSite=lax`, posé
**directement par le backend** via `Set-Cookie` — le proxy le relaie tel
quel sur les routes d'authentification, il ne le construit jamais
lui-même.

**Enveloppe de réponse** : `lib/api/client.ts` déballe `{success,data,meta}`
côté succès, lit `error.message`/`error.code` côté échec — voir
`docs/frontend/contrat-api.md`.

## Justification

**Pourquoi laisser le backend poser le refresh token, contrairement à
Oumra-hadj-web.** C'est le choix documenté par `docs/backend/adr/0004-*.md`
(repris de smartsms-backend) : minimiser le nombre d'endroits où la valeur
en clair du refresh token est manipulée, en la déposant en `Set-Cookie` au
plus près de son émission plutôt que de la faire transiter par un corps
JSON même lu côté serveur par un proxy de confiance.

**Pourquoi déballer une enveloppe, contrairement à Oumra-hadj-web.** Le
backend DarMeuble en applique une — le client HTTP doit refléter le
contrat réel, pas celui d'un projet frère au backend différent.

## Conséquences

- Le proxy `src/app/api/[...chemin]/route.ts` a deux comportements
  distincts selon la route : reconstruire le cookie d'access token à
  partir du JSON pour la plupart des routes, relayer le `Set-Cookie` tel
  quel pour les routes d'authentification.
- La file d'attente de requêtes concurrentes sur le renouvellement (voir
  `docs/backend/adr/0004-*.md` §Conséquences) reste une responsabilité
  frontend — le backend suppose que les appels à `/refresh` sont
  sérialisés côté client.

## Alternatives écartées

**Reproduire tel quel le proxy d'Oumra-hadj-web (les deux cookies posés
côté Next).** Écarté : contredirait directement le choix déjà documenté
côté backend (ADR-0004) de poser le refresh en `Set-Cookie` direct.
