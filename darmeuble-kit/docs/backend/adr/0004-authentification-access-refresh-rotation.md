# ADR-0004 — Authentification : access/refresh token avec rotation

## Statut

Proposé — repris de `smartsms-backend` (ADR-0018 de ce projet frère,
proposé chez eux aussi au moment de la rédaction, migration depuis un
modèle à jeton unique).

## Contexte

Le cahier des charges (§6.4) demande une "authentification sécurisée (mot
de passe hashé, JWT, éventuellement OTP par SMS pour les locataires)" sans
trancher la durée de vie ni le mécanisme de renouvellement.

Deux modèles existent déjà chez les projets frères : `Oumra-hadj-project`
utilise un refresh token JWT signé (plus simple), `smartsms-backend` migre
vers un refresh token opaque haché avec rotation et détection de
réutilisation (plus robuste, plus coûteux à implémenter).

## Décision

**Un couple access token (court) / refresh token (long, rotatif) par
session**, sur le modèle exact de smartsms-backend :

- **Access token** — JWT signé `{ sub, sid }`, 15 minutes
  (`JWT_ACCESS_EXPIRES_IN`), porté par `Authorization: Bearer`.
- **Refresh token** — valeur aléatoire opaque (`randomBytes(64)`), jamais
  un JWT. Hachée en SHA-256 avant stockage. Durée de vie 7 jours par
  défaut (`JWT_REFRESH_EXPIRES_IN`), déposée par le **backend** dans un
  cookie `httpOnly` + `secure` + `sameSite=lax`.
- Chaque refresh token est rattaché à une session révocable
  (`UserSession` ou équivalent) par clé étrangère `onDelete: Cascade` —
  révoquer la session révoque toute sa famille de jetons.
- `POST /api/auth/refresh` réclame le token atomiquement
  (`UPDATE ... WHERE token_hash = ? AND used_at IS NULL AND expires_at > now()`).
  Une réclamation qui échoue sur un token déjà marqué `usedAt` **révoque la
  session entière**, pas seulement la requête — signe probable de vol
  (rejeu d'un token intercepté).

**Deux parcours de connexion**, comme au cahier des charges §6.4 et §9.2 :

- **Locataire** : téléphone + OTP SMS.
- **Propriétaire / gestionnaire / comptable / super admin** : email + mot
  de passe.

Les deux émettent le même couple de jetons par un chemin unique
(`issueAuthResult` ou équivalent) — pas une logique de signature dupliquée
par parcours.

## Justification

**Pourquoi ce modèle plutôt que le refresh JWT signé d'Oumra-hadj.** Le
coût d'une session volée est plus élevé ici : DarMeuble manipule des
paiements de loyer et des abonnements facturables, contrairement à un
contexte où le pire cas est une session pèlerin compromise. La détection de
réutilisation (impossible avec un JWT signé classique, qui ne nécessite pas
de consultation base à chaque usage) est le bénéfice qui justifie le coût
d'implémentation supplémentaire.

**Pourquoi le backend pose le cookie du refresh token lui-même**, comme
smartsms-backend, et non le proxy Next.js comme pour l'access token (voir
`docs/frontend/adr/0002-*.md`) : le refresh token ne doit jamais transiter
par un corps de réponse JSON, même lu côté serveur par un proxy de
confiance — le déposer directement en `Set-Cookie` depuis le backend réduit
la surface qui voit sa valeur en clair.

**Pourquoi une valeur opaque plutôt qu'un second JWT.** Une vérification en
base est de toute façon nécessaire à chaque `/refresh` pour contrôler
`usedAt` — autant stocker directement une valeur aléatoire et la chercher
par son empreinte, plus simple qu'un JWT signé pour le même résultat.

## Conséquences

- Nouveau modèle Prisma `RefreshToken` (ou `UserSession` porteur du
  jeton), migration dédiée.
- `cookie-parser` (ou équivalent) au boot pour lire le cookie refresh.
- Le frontend doit coordonner : intercepteur, `middleware.ts`, file
  d'attente de requêtes concurrentes sur le renouvellement — voir
  `docs/frontend/adr/0002-jeton-cookie-httponly-proxy.md`.
- Les appels concurrents à `/refresh` avec le **même** token ne sont pas
  traités avec indulgence : un seul gagne la réclamation atomique, l'autre
  est traité comme une réutilisation. Le frontend doit sérialiser ses
  appels de rafraîchissement (file d'attente), pas supposer que le backend
  absorbe le doublon.

## Alternatives écartées

**Refresh JWT signé, comme Oumra-hadj-project.** Plus simple, mais
n'apporte pas la détection de réutilisation — écarté vu la nature
financière du projet.

**Refresh token en JSON, cookie posé par le proxy Next.js** (symétrique à
l'access token). Écarté pour minimiser le nombre d'endroits où la valeur en
clair est manipulée — même raisonnement que smartsms-backend.

**Une table `TokenFamily` séparée de la session.** Rejeté : la session
remplit déjà ce rôle et est déjà pensée comme révocable.
