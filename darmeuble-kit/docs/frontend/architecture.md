# Architecture — DarMeuble frontend

À tenir à jour contre l'état réel du dépôt une fois créé. Stack et
arborescence complètes : `docs/frontend/socle-frontend.md`.

## Le proxy — la pièce centrale

Identique au principe d'`oumra-hadj-web-kit` (ADR-0002 de ce kit) : le
navigateur appelle `/api/*` (Next), jamais le backend directement. Les
Route Handlers de `src/app/api/[...chemin]/route.ts` relaient en ajoutant
l'en-tête `Authorization` lu dans le cookie d'access token.

**Différence à ne pas manquer** : le refresh token est posé **par le
backend lui-même** (voir `docs/backend/adr/0004-*.md`), pas par ce proxy.
Sur les routes d'authentification (`/api/auth/login`, `/api/auth/otp/verify`,
`/api/auth/refresh`), le proxy doit **relayer le `Set-Cookie` du backend
tel quel** au navigateur plutôt que de le reconstruire — copier le proxy
d'`oumra-hadj-web-kit` sans ajuster ce point poserait un cookie halluciné
par le frontend au lieu de celui, correctement haché et lié à une session,
émis par le backend.

## Enveloppe de réponse — voir `docs/frontend/contrat-api.md`

Le backend applique `{success,data,meta}`/`{success:false,error}` — le
client HTTP (`lib/api/client.ts`) déballe cette enveloppe, contrairement à
celui d'`oumra-hadj-web-kit` qui consomme une réponse brute.

## Trois espaces, pas un `AppShell` unique

Voir `docs/frontend/socle-frontend.md` §1 — `(organization)`, `(tenant)`,
`(super-admin)` comme trois groupes de routes distincts.

## Déploiement

Serveur Node requis (le proxy l'impose), comme les deux projets frères.
Infrastructure non tranchée pour DarMeuble — à documenter dans un ADR une
fois choisie, pas supposée identique à celle des projets sources.
