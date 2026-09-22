# 0016 — API publique pour partenaires (widget de réservation embarquable)

- **Statut** : proposé
- **Date** : 2026-09-11

## Contexte

Idée #50 du brainstorm "Cent Fonctionnalités" : permettre à une agence ayant
son propre site web d'y intégrer un widget de réservation consommant
l'API. Aujourd'hui, toute l'API (`docs/api-versioning.md`) est pensée pour
être consommée par des clients de confiance (app mobile officielle,
back-office web officiel) authentifiés par compte utilisateur (JWT). Exposer
une partie du catalogue à un site web tiers est un changement de modèle de
confiance, pas juste un nouvel endpoint.

## Décision proposée

- Nouveau mécanisme d'authentification **par clé API**, distinct du JWT
  utilisateur — une clé par agence, révocable indépendamment de son compte
  principal.
- Périmètre volontairement restreint : **lecture seule** sur le catalogue
  public de forfaits de l'agence propriétaire de la clé (`GET /packages`
  filtré), jamais d'écriture, jamais de données pèlerin. Une réservation
  initiée depuis le widget redirige vers l'app/le site officiel pour
  l'authentification du pèlerin — la clé API ne doit jamais permettre de
  contourner l'authentification OTP.
- Limitation de débit (rate limiting) dédiée par clé, plus stricte que le
  throttling global actuel (`configuration.ts`, `throttle`), pour éviter
  qu'un site partenaire mal codé ne dégrade l'API pour tout le monde.
- Clé API jamais journalisée en clair (même règle que tout secret, voir
  `docs/secrets-management.md`) — stockée hachée côté serveur, comme les
  refresh tokens (`RefreshToken.tokenHash`).

## Questions ouvertes

- Auto-service (l'agence génère sa clé elle-même depuis son espace) ou
  validation manuelle par l'admin avant activation ?
- Faut-il un quota d'appels par clé (pas seulement un rate limit temporel) ?
- CORS : quelles origines autoriser si le widget tourne dans le navigateur
  d'un visiteur du site partenaire plutôt que côté serveur de l'agence ?

## Conséquences

- Débloque #50.
- Premier mécanisme d'authentification non-JWT du backend — à documenter
  clairement dans `docs/auth-flow.md` une fois accepté, pour ne pas être
  confondu avec le flux pèlerin/agence existant (ADR 0003).
