# 0026 — Réinitialisation du mot de passe (agence / admin) par email

- **Statut** : proposé
- **Date** : 2026-10-02
- **Décideurs** : à confirmer par le porteur de projet (Sory KEITA)
- **Complète** : [0003 — Stratégie d'authentification](0003-strategie-authentification.md) (accepté), [0025 — Code OTP par email via EmailJS](0025-otp-par-email-emailjs.md) (accepté)

## Contexte

Les comptes agence et admin se connectent par email + mot de passe
(ADR 0003). Aucun moyen n'existe pour retrouver l'accès après un oubli : il
faut intervenir à la main en base. Le frontend a une page
`/forgot-password` sans contrat API (ticket web #73). Un canal email existe
déjà côté serveur (EmailJS, ADR 0025).

## Décision

1. **Deux routes publiques** :
   - `POST /auth/password/forgot` `{ email }` → `200 { sent: true }`,
     toujours, que le compte existe ou non (pas d'énumération des comptes).
   - `POST /auth/password/reset` `{ token, newPassword }` → `204`, ou `400`
     « Lien invalide ou expiré ».
2. **Périmètre** : uniquement les comptes **agence** et **admin**, actifs,
   qui ont un mot de passe. Pèlerins et guides n'ont pas de mot de passe
   (OTP, ADR 0003 / 0025) : aucune demande n'est envoyée pour eux.
3. **Jeton** : 32 octets aléatoires (`crypto.randomBytes`), encodés en
   base64url, **à usage unique**, valables **30 minutes**
   (`PASSWORD_RESET_TTL_MINUTES`). Seul son **SHA-256** est stocké (table
   `password_reset_tokens`) : un jeton de cette entropie n'a pas besoin d'un
   hachage lent, et l'empreinte permet une recherche indexée. Une nouvelle
   demande remplace les jetons précédents du compte.
4. **Lien** : `{WEB_APP_URL}/reset-password#token=…`. Le jeton est placé
   dans le **fragment** d'URL, que le navigateur n'envoie jamais au serveur :
   il n'apparaît ni dans les journaux d'accès (Vercel, Render), ni dans un
   en-tête `Referer`.
5. **Effets d'une réinitialisation réussie** : nouveau mot de passe haché
   (bcrypt, comme à l'inscription ; 8 à 72 caractères — limite de bcrypt),
   suppression de tous les jetons de réinitialisation du compte et
   **révocation de toutes ses sessions** (refresh tokens), dans une seule
   transaction.
6. **Envoi par EmailJS** avec un **gabarit dédié**
   (`EMAILJS_RESET_TEMPLATE_ID`), mêmes identifiants de service que
   l'ADR 0025. Variables : `{{to_email}}`, `{{reset_url}}`,
   `{{expires_in_minutes}}`, `{{app_name}}`.
7. **Disponibilité** : EmailJS + gabarit + `WEB_APP_URL` configurés → envoi
   réel. Sinon, hors production, le lien est journalisé (développement
   uniquement) ; en **production**, `forgot` répond `503` avant toute
   recherche de compte (même réponse pour tous, donc pas d'énumération).
8. **Échec d'envoi** (EmailJS indisponible) : journalisé sans l'adresse ni
   le lien (donnée saisie : pas d'injection possible dans les journaux) ; la réponse reste `{ sent: true }` pour ne pas
   révéler qu'un compte existe à cette adresse.
9. **Anti-abus** : 3 demandes par minute et par IP sur `forgot`, 10 sur
   `reset`, en plus de la limite globale.

## Conséquences

- Une agence qui a oublié son mot de passe retrouve l'accès sans
  intervention manuelle ; toutes ses sessions ouvertes sont fermées.
- Nouvelle table et nouvelles variables d'environnement côté Render :
  `EMAILJS_RESET_TEMPLATE_ID`, `WEB_APP_URL` (et, optionnellement,
  `PASSWORD_RESET_TTL_MINUTES`).
- Un échec d'envoi est silencieux pour l'utilisateur (point 8) : il ne
  reçoit rien et peut redemander. C'est le prix de la non-énumération.
- Le changement de mot de passe depuis une session ouverte (« modifier mon
  mot de passe ») n'est pas couvert ici — à traiter dans un ticket dédié.
