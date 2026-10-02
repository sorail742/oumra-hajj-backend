# 0025 — Code OTP par email via EmailJS

- **Statut** : accepté
- **Date** : 2026-10-02
- **Décideurs** : Sory KEITA (demande explicite du porteur de projet, 2026-10-02)
- **Complète** : [0003 — Stratégie d'authentification](0003-strategie-authentification.md) (accepté) ; le fournisseur SMS reste ouvert ([0009](0009-notifications.md), [0018](0018-canal-sms-ussd.md))

## Contexte

L'ADR 0003 prévoit, pour le pèlerin et le guide, une connexion par numéro de
téléphone + code OTP envoyé par SMS. Aucun fournisseur SMS n'est encore
retenu : l'implémentation actuelle (`ConsoleOtpSender`) écrit le code dans
les journaux du serveur. En démonstration, il faut lire les journaux Render
pour se connecter, et un code de connexion se retrouve dans des journaux —
contraire à la règle « aucune donnée sensible dans un log » (`CLAUDE.md`).

Le porteur du projet a demandé que le code arrive **par email** via
**EmailJS** (compte existant), en attendant un fournisseur SMS.

## Décision

1. **Second canal OTP : l'email.** `POST /auth/otp/request` et
   `POST /auth/otp/verify` acceptent **soit** `phone` (inchangé), **soit**
   `email` — exactement l'un des deux, validé par `class-validator`. Le
   contrat existant (`phone`) ne change pas : pas de nouvelle version d'API
   (ADR 0005).
2. **Fournisseur : EmailJS**, appelé côté serveur par son API REST
   (`POST https://api.emailjs.com/api/v1.0/email/send`), authentifié par la
   **clé privée** (`accessToken`) en plus de la clé publique. Aucune clé
   n'est exposée au navigateur ni à l'application mobile.
3. **Configuration uniquement par variables d'environnement** (hébergeur) :
   `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`,
   `EMAILJS_PRIVATE_KEY`. Jamais dans le dépôt, jamais dans un log.
4. **Aucun code dans les journaux de production, quel que soit le canal.**
   Email sans EmailJS configuré, ou SMS tant qu'aucun fournisseur n'est
   retenu : en développement et en test, le code est journalisé ; en
   **production**, la demande échoue en `503` (décision du porteur de
   projet, 2026-10-02). La connexion par téléphone est donc indisponible en
   production jusqu'au choix d'un fournisseur SMS.
5. **Périmètre des rôles inchangé (ADR 0003)** : l'OTP par email ne connecte
   qu'un pèlerin ou un guide. Une adresse rattachée à un compte agence ou
   admin ne reçoit aucun code (réponse identique `{ sent: true }`, pour ne
   pas révéler l'existence du compte) et la vérification est refusée : ces
   comptes gardent l'email + mot de passe.
6. **Anti-abus** : limite de débit dédiée sur `otp/request` (5 par minute
   et par IP) et `otp/verify` (10 par minute), en plus de la limite globale
   et des 5 tentatives maximum par code déjà en place.
7. Le journal d'un échec d'envoi ne contient ni le code ni l'adresse
   complète (adresse masquée : `a***@domaine`).

## Gabarit EmailJS attendu

Le gabarit (« template ») doit utiliser ces variables :

| Variable                 | Contenu                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `{{to_email}}`           | destinataire — à placer dans le champ **To Email** du gabarit |
| `{{otp_code}}`           | le code à usage unique                                        |
| `{{expires_in_minutes}}` | durée de validité                                             |
| `{{app_name}}`           | « Oumra & Hadj »                                              |

Dans le compte EmailJS : _Account → Security_ → activer **« Allow EmailJS
API for non-browser applications »** et **« Use Private Key »** ; sans
cela, l'appel serveur est refusé (`403`).

## Conséquences

- Un pèlerin sans téléphone joignable par SMS peut se connecter avec une
  adresse email ; un même compte peut porter les deux identifiants.
- Dépendance à un service tiers supplémentaire (quota de l'offre EmailJS) :
  en cas d'indisponibilité, l'API renvoie `503` et l'interface invite à
  réessayer.
- Les comptes pèlerin/guide créés par téléphone ne peuvent plus se
  connecter en production tant qu'un fournisseur SMS n'est pas branché.
  Se connecter par email crée un **nouveau** compte : aucun rattachement
  d'une adresse à un compte téléphone n'existe encore (il faudrait vérifier
  l'adresse avant de la lier — à traiter dans un ticket dédié).
- Lorsque le fournisseur SMS sera retenu, il remplacera `ConsoleOtpSender`
  dans `sms-otp-sender.provider` sans toucher au canal email.
