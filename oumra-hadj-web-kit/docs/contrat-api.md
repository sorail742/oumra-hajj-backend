# Oumra & Hadj — État du contrat API

Ce que le frontend peut consommer aujourd'hui, vérifié directement contre le
code du backend (`Oumra-hadj-project`) — pas contre une supposition ni contre
le comportement d'un projet frère.

**Toute affirmation ci-dessous a été vérifiée par lecture du code backend au
moment de la rédaction.** Si le backend évolue, ce document doit être
revérifié avant d'être utilisé pour construire un écran — même discipline
que `smartsms-frontend` applique à son propre `contrat-api.md`.

---

## Ce qui va bien

**Le contrat vit dans `openapi.json`**, régénéré côté backend via
`npm run openapi:export` (script `scripts/export-openapi.ts`), à copier à la
racine d'`oumra-hadj-web` avant `pnpm dlx openapi-typescript`.

**L'authentification est complète et déjà en rotation.** Contrairement à ce
que documente smartsms-frontend pour son propre backend (jeton unique 7
jours, refresh à venir), `Oumra-hadj-project` a d'ores et déjà :

- `POST /auth/otp/request`, `POST /auth/otp/verify` — pèlerin/guide
- `POST /auth/agency/login` — agence/admin
- `POST /auth/refresh` — rotation du refresh token
- `POST /auth/logout` — révocation

Voir `docs/socle-frontend.md` §5 pour le contrat de cookies à implémenter en
conséquence.

**Le préfixe et le versionnage sont réguliers.** `setGlobalPrefix('api')` +
`enableVersioning({ type: URI, defaultVersion: '1' })` — toute route répond
sous `/api/v1/...`. Pas d'exception connue à ce jour (à revérifier si un
jour une route `health`/`docs` s'avère hors versionnage, comme c'est le cas
côté smartsms-backend).

---

## Ce qui diffère de smartsms-frontend — à ne pas transposer

### Aucune enveloppe de réponse unifiée

Pas de `ResponseInterceptor` ni d'`AllExceptionsFilter` porteur d'un format
`{ success, data, meta }`. Vérifié dans
`src/common/filters/http-exception.filter.ts` du backend : c'est le seul
filtre global, et il ne s'applique qu'aux erreurs.

**Une réponse réussie est le DTO brut** — `GET /packages/:id` renvoie
directement `{ id, agencyId, title, price, … }`, pas
`{ success: true, data: { … } }`. Un client HTTP écrit en supposant
l'enveloppe de smartsms produirait `undefined` partout.

### Format d'erreur — celui de NestJS par défaut

```ts
interface ErrorBody {
  statusCode: number;
  timestamp: string;    // ISO
  path: string;
  message: string | string[];  // tableau sur erreur class-validator
  error?: string;               // ex. "Bad Request" — pas systématique
}
```

**Aucun champ `code` métier stable.** Contrairement au contrat que documente
smartsms-frontend (`ApiErrorBody.code`, alimenté par l'issue backend #122
chez eux), rien de comparable n'existe ici aujourd'hui. Un `409` sur
`POST /reviews` (avis déjà déposé) et un `409` sur
`POST /payments/:id/refund` (statut incompatible) ne se distinguent que par
leur `message` textuel — fragile si le texte change.

**Recommandation, en attendant une évolution du contrat backend** : router
sur le **statut HTTP + le contexte de l'écran** plutôt que sur le texte du
message quand c'est possible (un `409` sur l'écran de dépôt d'avis a un sens
clair sans lire le message), et n'afficher le message brut du backend que
comme repli — pas comme source de logique.

### Aucune pagination, sur aucun endpoint

Vérifié sur l'ensemble des contrôleurs (`grep` sur les paramètres de requête
liés à la pagination) : zéro résultat. `GET /packages`, `GET /agencies`,
`GET /reviews/agency/:id`, `GET /reviews/mine`, `GET /bookings`… renvoient
un tableau complet.

C'est plus radical que la situation décrite par smartsms-frontend (48 routes
de collection sur 54 sans pagination, mais 6 qui en ont une réelle) :
ici, **aucune route ne pagine côté serveur** à ce jour. `DataTable` pagine
donc systématiquement côté client — pas de code à écrire « en double » pour
gérer une pagination serveur qui n'existe nulle part.

### Rôles — quatre valeurs plates, pas de matrice de permissions

```
pilgrim · agency · guide · admin
```

Vérifié dans `src/common/enums/role.enum.ts`. Le contrôle d'accès backend
est un simple `@Roles(Role.X)` par route (`RolesGuard`), pas une matrice
consultable côté client comme `GET /api/permissions/matrix` chez smartsms —
**aucune route équivalente n'a été repérée** dans le backend actuel. Le rôle
de l'utilisateur courant vit dans le payload du JWT (`JwtPayload.role`), lu
côté serveur.

---

## Domaines exposés, vérifiés dans le code backend

| Domaine | Ce qu'il expose |
| --- | --- |
| `agencies` | inscription, profil, validation admin, documents légaux + alertes de conformité (idée #56), calendrier ICS des échéances (idée #70) |
| `packages` | forfaits, étapes, recommandation par budget/dates/taille de groupe (idée #10) |
| `bookings` | réservations, suivi de dossier par étapes (`DossierStepKey`/`DossierStepStatus`) |
| `documents` | documents pèlerin (passeport, visa, billet, certificat de vaccination), validation agence, URL d'accès signée |
| `payments` | paiements par tranche (Mobile Money Orange/MTN, carte), remboursement selon barème (idée #58) |
| `reviews` | avis, score de confiance agence, badge de certification (idées #96, #61), rapport de satisfaction exportable (idée #64) |
| `rites` | fiches de rites (contenu à valider), progression pèlerin (tawaf/sai) |
| `trip-summary` | livret souvenir agrégé (idée #23) |
| `groups` | groupes de voyage, bouton SOS |
| `messaging` | messagerie pèlerin ↔ agence/guide |
| `calendar` | flux ICS public, consommé par jeton (pas par JWT — voir note ci-dessous) |

**Le flux ICS (`GET /calendar/agency/:token/calendar.ics`) est volontairement
hors authentification JWT** : les clients calendrier (Google, Outlook) ne
peuvent pas envoyer d'en-tête `Authorization` sur une URL d'abonnement.
L'autorisation tient au jeton opaque dans l'URL elle-même. **Ne jamais faire
passer cet appel par le proxy authentifié `/api/[...chemin]`** — c'est un
appel public direct au backend, à traiter comme tel dans `lib/api/`.

---

## Contenu religieux — contrainte à porter jusqu'à l'écran

Le backend signale-t-il une fiche de rite comme validée ? **À vérifier au
câblage réel** : si le schéma actuel des fiches de rites ne porte pas encore
de champ de validation explicite, c'est un écart à signaler côté backend
avant de construire l'écran — ne jamais supposer qu'une fiche est validée
par défaut pour avancer plus vite. Voir `docs/design-system.md` §7,
`ReligiousContentNotice`.

---

## Comment travailler avec un contrat encore jeune

### Valider avec zod à la frontière

Même méthode que smartsms-frontend — voir `docs/socle-frontend.md` §4 pour
un exemple concret sur `bookings`.

### Ne pas halluciner un champ absent de la réponse observée

Le backend n'applique pas de sérialisation qui retirerait des champs
internes d'un modèle Prisma sur toutes les routes — vérifier la réponse
réelle (via Swagger, `openapi.json`, ou un appel direct) avant de supposer
qu'un champ est exposé. Un schéma zod qui ne déclare que les champs
effectivement utilisés protège contre une fuite de champ interne, dans un
sens comme dans l'autre.

---

## Garde-fou à mettre en place

Même principe que smartsms-frontend : si `src/lib/api/generated.ts` diffère
du fichier commité après régénération depuis `openapi.json`, la CI doit
échouer — c'est ce qui empêche le frontend de dériver silencieusement du
backend. À câbler dès qu'un pipeline CI existe pour `oumra-hadj-web`.
