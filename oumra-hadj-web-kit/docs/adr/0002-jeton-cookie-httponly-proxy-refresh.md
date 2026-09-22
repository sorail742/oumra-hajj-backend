# ADR-0002 — Jeton en cookie httpOnly, proxy avec renouvellement automatique

## Statut

Proposé

## Contexte

Le backend `Oumra-hadj-project` expose un contrat access + refresh déjà
complet et en rotation (`POST /auth/refresh`, voir `docs/contrat-api.md`) —
à la différence du backend de `smartsms-frontend`, qui documente
explicitement l'absence de refresh comme une limitation assumée (jeton
unique 7 jours, ADR-0016 de leur backend).

Cette différence change la décision à prendre : là où smartsms-frontend
choisit délibérément de **ne pas** construire de file d'attente de requêtes
concurrentes (ce serait du code mort face à un backend qui ne rafraîchit
rien), l'omettre ici serait l'inverse — un renouvellement silencieux existe
côté backend, ne pas le câbler produirait des déconnexions évitables toutes
les 15 minutes (durée par défaut de l'access token, voir
`src/config/configuration.ts` du backend).

## Décision

**Deux cookies `httpOnly` + `secure` + `sameSite=lax`**, posés par les Route
Handlers de Next :

| Cookie | Contenu | Portée |
| --- | --- | --- |
| `oumra_access` | `accessToken` | lu par le proxy pour l'en-tête `Authorization` |
| `oumra_refresh` | `refreshToken` | lu uniquement pour appeler `POST /auth/refresh` |

**Le proxy gère le renouvellement lui-même**, sans intervention du
navigateur :

1. Un appel relayé reçoit `401` du backend.
2. Le proxy appelle `POST /auth/refresh` avec `oumra_refresh`.
3. Succès : les deux cookies sont remplacés, la requête d'origine est
   rejouée avec le nouvel `accessToken`, le navigateur ne voit qu'une
   réponse réussie légèrement retardée.
4. Échec : les deux cookies sont effacés, le navigateur reçoit `401` et
   redirige vers `/login`.

**Requêtes concurrentes** : si plusieurs appels échouent en `401` pendant la
même fenêtre, un seul déclenche `POST /auth/refresh` ; les autres attendent
son résultat au lieu d'appeler chacun le renouvellement — voir
`code-templates/lib/auth/session.ts` pour un point de départ d'implémentation
(verrou en mémoire du processus serveur, à réévaluer si le déploiement passe
un jour en plusieurs instances sans état partagé).

`deviceId`, s'il s'avère nécessaire (aucune route backend ne l'exige
aujourd'hui, contrairement à smartsms où il est obligatoire au login) :
ne pas l'ajouter par anticipation d'un besoin qui n'existe pas dans le
contrat actuel.

## Justification

**Un XSS ne peut pas exfiltrer le jeton** — le gain principal, partagé avec
smartsms-frontend (ADR-0005).

**Le renouvellement automatique évite une gêne réelle et récurrente.** Un
access token de 15 minutes sans renouvellement silencieux déconnecterait un
pèlerin en train de remplir un formulaire de réservation plusieurs fois par
session — pire que l'absence de refresh chez smartsms, où le jeton dure sept
jours entiers.

**`sameSite=lax` suffit**, pour la même raison que documentée par
ADR-0005 de smartsms-frontend : navigateur et Next partagent l'origine, pas
de requête cross-site à autoriser.

## Conséquences

### Ce que cela impose

- Chaque appel API passe par le proxy — aucun composant n'appelle le
  backend directement (exception documentée : le flux calendrier ICS, voir
  `docs/contrat-api.md`).
- Le proxy doit conserver un état partagé (verrou de renouvellement) entre
  requêtes concurrentes du même utilisateur — trivial sur une instance
  unique, à revoir explicitement si le déploiement introduit plusieurs
  instances sans mémoire partagée (Redis ou équivalent).

### Ce que cela ne résout pas

Le refresh token reste valable jusqu'à sa durée configurée (30 jours par
défaut) : sa révocation (`POST /auth/logout`) reste le seul moyen de couper
un accès avant expiration naturelle si l'endpoint de session révocable
existe côté backend — à vérifier contre `openapi.json` avant de promettre un
écran « Sessions actives » à l'utilisateur.

## Alternatives écartées

**Reproduire le choix de smartsms-frontend (pas de file d'attente).**
Justifiable chez eux par l'absence de refresh côté backend ; ici, ce serait
ignorer une capacité du backend déjà construite pour son propre bénéfice,
au prix d'une expérience utilisateur dégradée sans raison technique.

**Jeton en mémoire seule côté client.** Perte de session à chaque
rechargement — inacceptable pour un usage réparti sur plusieurs jours
(suivi de dossier).
