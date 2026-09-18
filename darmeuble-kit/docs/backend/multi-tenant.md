# DarMeuble — Isolation multi-tenant

Repris directement de `smartsms-backend`, qui a trouvé et corrigé les
failles que ce document encode — pas une prudence théorique. DarMeuble a le
même profil de risque : plusieurs organisations (propriétaires/agences)
partageant une seule base de données, avec des données financières
(loyers, dépôts de garantie) au milieu.

## Le principe

Chaque table métier (`Building`, `Unit`, `Tenant`, `Lease`, `Payment`,
`Expense`, `MaintenanceRequest`, `Document`...) porte un `organizationId`.
**Toute requête Prisma sur une de ces tables filtre explicitement dessus.**
Un oubli expose les données d'une organisation à une autre — c'est
l'exigence de sécurité la plus haute du cahier des charges (§6.4
"isolation stricte des données entre tenants", §12.2 la classe en risque
identifié dès le cadrage).

## `AuthenticatedUser` — résolu une fois, jamais rechargé

Reproduit le pattern smartsms-backend (`docs/coding-rules-backend.md`
§"Accès aux données et multi-tenant" de ce projet frère) : trois modules y
avaient chacun réimplémenté la résolution de l'utilisateur courant, jusqu'à
deux requêtes DB identiques par requête HTTP.

```ts
// src/types/auth/authenticated-user.interface.ts
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  organizationId: string | null; // null pour un super_admin non rattaché
  role: 'super_admin' | 'owner' | 'manager' | 'accountant' | 'tenant';
}
```

`JwtStrategy.validate()` la construit **une seule fois** par requête, à
partir du payload du JWT (pas d'un rechargement de `User` depuis la base).
`@CurrentUser()` l'expose aux controllers. **Un service ne recharge jamais
l'utilisateur courant depuis la base** — s'il manque un champ, l'ajouter au
payload JWT et à `AuthenticatedUser`, pas réinjecter un repository
utilisateur dans un service qui n'en a pas besoin autrement.

`organizationId` est nullable : un `super_admin` peut n'être rattaché à
aucune organisation (cahier des charges §4, "vue transverse pour
l'exploitation de la plateforme"). Vérifier explicitement avant usage,
jamais d'assertion non-null.

## La règle ESLint — ne pas compter sur la seule revue humaine

Répliquer `tools/eslint-rules/require-client-id-filter.js` de
smartsms-backend, renommée pour ce projet
(`darmeuble/require-organization-id-filter`) :

- Cible uniquement `**/*.repository.ts` (c'est la seule couche qui touche
  Prisma, voir `docs/backend/adr/0003-*.md`).
- Signale tout appel Prisma (`findFirst`, `findUnique`, `findMany`,
  `count`, `aggregate`, `groupBy`, `update`, `updateMany`, `upsert`,
  `delete`, `deleteMany`, et variantes `OrThrow`) sur un modèle
  tenant-scopé dont le `where` ne contient pas `organizationId` (ou une
  relation parente équivalente, configurable modèle par modèle).
- Liste `TENANT_SCOPED_MODELS` à tenir à jour dans `eslint.config.mjs` —
  `Building`, `Unit`, `Tenant`, `Lease`, `Payment`, `Expense`,
  `MaintenanceRequest`, `Document`, `Notification`. **Un nouveau modèle
  métier non ajouté à cette liste n'est pas contrôlé** — fermer ce trou
  dans la même MR qui introduit le modèle, pas après coup.
- `warn` au départ, `error` une fois la baseline vidée — même politique de
  rollout que smartsms-backend.
- Échappatoire : `// eslint-disable-next-line darmeuble/require-organization-id-filter — <justification>`,
  jamais sans commentaire. Cas légitimes attendus : requêtes super-admin
  transverses dans `admin/`, `payment.findUnique({ where: { referenceDjomy } })`
  (unicité globale garantie par le fournisseur de paiement), scans
  techniques (auth, cron de purge).

## Portée intra-organisation — ne pas confondre avec l'isolation inter-organisation

Le "gestionnaire délégué" (`manager`) a une portée **limitée aux immeubles
qui lui sont assignés** au sein de sa propre organisation (cahier des
charges §4) — une deuxième couche de filtrage, à l'intérieur du filtre
`organizationId`, pas à sa place.

**Ne pas fusionner les deux filtres dans une seule condition ad hoc par
requête.** Modéliser explicitement l'assignation (table de jonction
`BuildingManager` ou équivalent — voir `N—N Buildings` dans le modèle de
données du cahier des charges, §7, pour `User`), et appliquer :

1. `organizationId = user.organizationId` (isolation inter-organisation,
   toujours, tous rôles) ;
2. puis, si `role === 'manager'` : `buildingId IN (SELECT buildingId FROM
   BuildingManager WHERE userId = user.userId)` (portée intra-organisation,
   seulement pour ce rôle).

Un `owner` ou un `accountant` de l'organisation n'a pas cette deuxième
restriction — il voit tous les immeubles de son organisation. Vérifier ce
point avec le porteur produit avant de généraliser un filtre par immeuble à
tous les rôles : le cahier des charges ne le demande que pour `manager`.

## Tests d'isolation — dès la Phase 1, pas après

Le cahier des charges l'identifie lui-même comme risque prioritaire (§12.2,
mitigation : "tests dédiés à l'isolation des données dès la phase socle").
Gabarit minimal, à écrire dès le premier module tenant-scopé :

```ts
it("n'expose jamais les données d'une autre organisation", async () => {
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  const buildingA = await createBuilding({ organizationId: orgA.id });

  const result = await service.findAllForOrganization(orgB.id);

  expect(result).not.toContainEqual(
    expect.objectContaining({ id: buildingA.id }),
  );
});
```

À décliner par table tenant-scopée, en intégration (base de test réelle)
plutôt qu'en mock pur — c'est une garantie sur le comportement réel de
Prisma/PostgreSQL, pas sur la logique applicative seule.
