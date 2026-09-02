# 0003 — Stratégie d'authentification et d'autorisation

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Quatre rôles (pèlerin, agence, guide, admin) doivent accéder à des périmètres de
données différents. Les pèlerins s'inscrivent principalement par numéro de
téléphone (public peu familier avec les mots de passe), tandis que agences/admin
ont besoin d'un accès web classique.

## Décision

- **Pèlerin / Guide** : authentification par numéro de téléphone + code OTP (SMS).
  Un token JWT (access court + refresh long) est délivré après validation de l'OTP.
- **Agence / Admin** : authentification email + mot de passe (hash bcrypt/argon2)
  + JWT, avec option 2FA à évaluer dans un ADR ultérieur si le besoin se confirme.
- **Autorisation** : `RolesGuard` NestJS basé sur un décorateur `@Roles(...)`,
  vérifié après un `AuthGuard('jwt')`. Chaque endpoint déclare explicitement les
  rôles autorisés — aucun endpoint sensible n'est ouvert par défaut.
- Les refresh tokens sont stockés côté serveur (hashés) pour permettre la
  révocation (déconnexion à distance, compte suspendu par l'admin).

## Conséquences

- Nécessite un provider SMS/OTP fiable (voir ADR à prévoir sur les intégrations
  tierces de notification si le choix du fournisseur devient une décision propre).
- Le back-office web (agence/admin) et l'app mobile (pèlerin/guide) partagent le
  même mécanisme JWT, ce qui simplifie l'API mais impose une gestion rigoureuse
  de l'expiration/rotation des tokens.
