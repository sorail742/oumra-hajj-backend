# Flux d'authentification

Référence : [ADR 0003](adr/0003-strategie-authentification.md) (accepté).
Implémentation : `src/modules/auth/`.

## Pèlerin / Guide — OTP par téléphone

```
Pèlerin                API                          Base
  |  POST /auth/otp/request {phone}                   |
  |------------------------------------------------->  |
  |                       génère code (6 chiffres,      |
  |                       crypto.randomInt),             |
  |                       hash bcrypt, stocke Otp        |
  |                       (TTL 5 min), purge les          |
  |                       anciens codes du numéro        |
  |                       envoie via OtpSender (SMS)      |
  |  200 { sent: true }                                  |
  |  <----------------------------------------------    |
  |                                                       |
  |  POST /auth/otp/verify {phone, code}                 |
  |------------------------------------------------->    |
  |                       vérifie hash + expiration +     |
  |                       compteur de tentatives (max 5)  |
  |                       si 1er login : crée User        |
  |                       (role=pilgrim)                  |
  |                       émet access + refresh JWT       |
  |  200 { accessToken, refreshToken }                    |
  |  <----------------------------------------------      |
```

Un compte `guide` n'est **jamais** créé via ce flux — il est provisionné à
l'avance (rôle `guide` déjà en base) par une agence/admin ; se connecter avec
le même numéro de téléphone récupère alors ce compte existant.

## Agence / Admin — email + mot de passe

```
Agence                 API                          Base
  |  POST /auth/agency/login {email, password}          |
  |------------------------------------------------->    |
  |                       findByEmailWithPassword         |
  |                       (passwordHash normalement       |
  |                       select:false, réinclus ici)     |
  |                       bcrypt.compare                  |
  |                       vérifie isActive                |
  |                       émet access + refresh JWT       |
  |  200 { accessToken, refreshToken }                    |
  |  <----------------------------------------------      |
```

Le compte agence est créé via `POST /agencies/register` (module `agencies`),
pas directement dans `auth` — voir `src/modules/agencies/agencies.service.ts`.

## Refresh & révocation

- Chaque refresh token émis est stocké **hashé** (bcrypt) en base
  (`RefreshToken`), avec sa date d'expiration.
- `POST /auth/refresh` : vérifie la signature JWT (secret refresh dédié),
  retrouve le token stocké correspondant par comparaison bcrypt, le révoque,
  en émet un nouveau (rotation à chaque refresh).
- `POST /auth/logout` : révoque le refresh token fourni. Ne révoque pas les
  autres sessions actives du même utilisateur (plusieurs appareils
  possibles).
- Un compte suspendu (`isActive: false`) est rejeté à la validation du JWT
  (`JwtStrategy.validate`) même si le token est encore valide.

## Autorisation

- `JwtAuthGuard` (global) : authentifie via JWT, laisse passer les routes
  marquées `@Public()`.
- `RolesGuard` (global) : si `@Roles(...)` est déclaré sur la route, seuls
  ces rôles passent ; sinon, tout utilisateur authentifié passe.
- **Aucune route sensible n'est ouverte par défaut** — toute route qui doit
  être restreinte à un rôle précis DOIT porter `@Roles(...)` explicitement.
- Le contrôle d'appartenance (ex. "cette réservation est-elle la mienne ?")
  est une responsabilité du **service**, pas du guard — voir les méthodes
  `findAuthorizedOrFail`/`assertOwnership` dans `bookings`, `payments`,
  `groups`, `documents`.

## Pour ajouter un nouvel endpoint protégé

Voir `coding-rules-backend.md`, section Auth.
