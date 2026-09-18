# DarMeuble — État du contrat API

À revérifier contre le code backend réel dès qu'il existe — ce document
décrit le contrat **décidé** (`docs/backend/coding-rules-backend.md`
§"Contrat de réponse HTTP"), pas un contrat observé sur un backend qui
n'est pas encore écrit.

## L'enveloppe — différence avec `oumra-hadj-web`

**Contrairement à `Oumra-hadj-project`** (réponse brute, pas d'enveloppe),
le backend DarMeuble applique la même convention que smartsms-backend :

```ts
// succès
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: PaginationMeta | Record<string, never>;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// erreur
interface ErrorResponse {
  success: false;
  error: {
    statusCode: number;
    message: string | string[]; // tableau sur erreur class-validator
    error: string;
    path: string;
    timestamp: string;
  };
}
```

**Ne pas copier `code-templates/lib/api/types.ts` d'`oumra-hadj-web-kit`
tel quel** — il modélise l'absence d'enveloppe. Reprendre plutôt la forme
`SuccessResponse`/`ErrorResponse` ci-dessus, directement inspirée de
`smartsms-frontend` (`src/lib/api/types.ts` de ce projet frère, qui
consomme exactement cette enveloppe).

## Pagination — toujours dans `meta`, jamais aplatie

Chaque endpoint de liste utilise `PaginationQueryDto` côté backend
(`page`, `limit`, `sortBy`, `sortOrder`) et renvoie `data` = tableau
d'éléments, `meta` = `{ page, limit, total, totalPages }`. **Une seule
forme, contrairement à smartsms-backend qui a dû composer avec deux
enveloppes héritées** (`data`/`pageSize` vs `items`/`perPage`, documenté
dans le `contrat-api.md` de smartsms-frontend) — DarMeuble démarre de zéro,
rien n'oblige à répéter cette incohérence : imposer `PaginationQueryDto`
sur toute nouvelle route de liste dès sa création plutôt que de la
découvrir après coup.

## Codes d'erreur métier — à décider tôt, pas après coup

Ni Oumra-hadj-project ni la version actuelle de smartsms-backend n'ont de
champ `error.code` stable — les deux documentent cette absence comme un
manque, pas un choix. **Pour DarMeuble, trancher ce point dès la Phase 1**
plutôt que de le découvrir en Phase 3 (paiements) quand la distinction
entre "quota dépassé" et "carte refusée" devient réellement utile à
l'interface :

```ts
interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: string; // ex. "SUBSCRIPTION_EXPIRED", "PAYMENT_DECLINED" — stable, jamais le texte
  path: string;
  timestamp: string;
}
```

Le frontend se branche sur `code`, jamais sur le texte de `message` — un
message peut changer de formulation sans préavis, un code ne doit pas.

## Multi-tenant côté frontend — rien à faire, sauf un point

L'isolation est entièrement backend (`docs/backend/multi-tenant.md`) : le
frontend n'a jamais à ajouter `organizationId` à une requête, il vient déjà
implicitement de la session. **Le seul point de vigilance** : ne jamais
faire porter un `organizationId` par le client dans un formulaire ou un
paramètre d'URL modifiable — ce serait une invitation à le manipuler pour
accéder aux données d'une autre organisation. L'API le lit uniquement dans
le JWT.

## Ce qui reste réellement à vérifier une fois le backend écrit

- Le format exact de `code` (voir ci-dessus) une fois `docs/backend/error-codes.md`
  (à créer, sur le modèle de celui de smartsms-backend) rédigé.
- Les champs exacts exposés par chaque endpoint — écrire un schéma zod à
  la frontière tant qu'`openapi-typescript` ne peut pas encore être
  régénéré contre un contrat stable, même méthode que documentée dans le
  `contrat-api.md` d'`oumra-hadj-web-kit`.
