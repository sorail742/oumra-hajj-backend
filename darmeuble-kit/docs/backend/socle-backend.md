# DarMeuble — Socle Backend

Document de référence pour la mise en place du backend NestJS de DarMeuble.
À lire avant la première ligne de code, avec `docs/cahier-des-charges.md`.

Adapté de `smartsms-backend` (isolation multi-tenant, pattern repository,
rotation de jetons, garde-fous financiers) et d'`Oumra-hadj-project`
(provider de paiement abstrait, conventions ADR/Git) — voir le tableau du
`README.md` de ce kit pour le détail de chaque emprunt.

---

## 0. Décisions actées

| Sujet | Décision |
| --- | --- |
| Framework | NestJS, TypeScript strict — version stable la plus récente au moment de l'installation, **épinglée sans `^`** |
| Base de données / ORM | PostgreSQL + Prisma, migrations versionnées |
| Accès aux données | **Pattern repository (port/adapter)** dès le premier module — voir `docs/backend/adr/0003-*.md` |
| Multi-tenant | Isolation par `organizationId` sur chaque table métier, contrôlée par ESLint + revue — voir `docs/backend/multi-tenant.md` |
| Authentification | Access token JWT court (15 min) + refresh token opaque haché avec rotation et détection de réutilisation — voir `docs/backend/adr/0004-*.md` |
| Contrat de réponse HTTP | Enveloppe unifiée `{success,data,meta}` / `{success:false,error}` dès la première route |
| Paiement | Provider abstrait (`PaymentProvider`), Djomy comme première implémentation — voir `docs/backend/paiements-djomy.md` |
| Suppression de données | Soft delete sur les entités racines (`Organization`, `Building`, `Unit`, `Tenant`, `Lease`) — voir `docs/backend/soft-delete.md` |
| Logger | Structuré (Pino ou équivalent), jamais `console.log` |
| Taille de fichier | Seuil de conception 400 lignes (`warn`), même règle que smartsms-backend |
| ADR | Un ADR par décision structurante, statut `proposé` avant implémentation — voir `docs/backend/adr/README.md` |

### Pourquoi le pattern repository dès le départ, contrairement à Oumra-hadj

Oumra-hadj-project injecte `PrismaService` directement dans ses services —
un choix assumé et documenté pour un projet à un contributeur principal, où
le découplage n'a pas (encore) de bénéfice mesurable. DarMeuble a un profil
différent dès le cahier des charges : plusieurs développeurs visés (§10,
phases), données financières (loyers, abonnements) et modèle multi-tenant —
exactement le contexte où smartsms-backend a justifié ce choix (ADR-0003 de
ce projet frère) : testabilité sans base réelle, et un point unique par
domaine où le filtre `organizationId` est appliqué et vérifiable.

### Pourquoi la rotation de refresh token, contrairement à Oumra-hadj

Oumra-hadj utilise un refresh token JWT signé, plus simple à mettre en
œuvre mais sans détection de réutilisation. DarMeuble manipule des paiements
de loyer et des abonnements facturables : le coût d'une session volée y est
plus élevé. Le modèle repris de smartsms-backend (ADR-0018 de ce projet
frère) — jeton opaque haché, rattaché à une session révocable, réclamation
atomique, suppression de la session entière en cas de réutilisation détectée
— est le bon niveau d'exigence pour ce profil de risque.

---

## 0bis. Décisions en attente

| Sujet | En attente de | Ce qui est bloqué |
| --- | --- | --- |
| Contrat réel de l'API/webhooks Djomy | Documentation technique Djomy, ou accès à un compte marchand de test | L'implémentation réelle de `DjomyPaymentProvider` — voir `docs/backend/paiements-djomy.md` §"Hypothèse à vérifier en premier" |
| Fournisseur SMS local | Choix produit (cahier des charges §12.3, hypothèse) | L'implémentation réelle de l'envoi SMS — développer contre une interface `SmsSender` abstraite en attendant, comme Oumra-hadj l'a fait pour son propre fournisseur |
| Modèle de tarification des plans d'abonnement | Décision produit (par immeuble ? par unité ? par palier ?) — cahier des charges §1.1 le formule encore comme trois options | `SubscriptionPlan.limites` et la logique de blocage à la limite (§5.11) |
| Modèles de contrat de location (PDF) | Fournis ou validés par l'équipe métier (cahier des charges §12.3) | Génération de bail PDF (§5.3) |
| Permissions fines du "gestionnaire délégué" par immeuble | Cahier des charges §4 les évoque ("selon les immeubles... qui lui sont assignés") sans détailler la portée exacte | Le design précis du filtre de portée au-delà du RBAC à plat — voir `docs/backend/multi-tenant.md` §"Portée intra-organisation" |

Ne pas deviner ces réponses pour avancer plus vite — elles engagent des
choix produit ou dépendent d'un tiers externe, pas d'une préférence
technique. Coder contre une interface abstraite (comme déjà pratiqué pour
`PaymentProvider`/`SmsSender`) permet d'avancer sans attendre.

---

## 1. Ce que ce socle décide, et ce qu'il ne décide pas

**Il décide** : la stack, l'arborescence, le pattern d'accès aux données,
l'isolation multi-tenant, l'authentification, le contrat HTTP, les
conventions de test et de Git.

**Il ne décide pas** : le détail métier de chaque module (règles exactes de
calcul des pénalités de retard, répartition des charges, contenu des
modèles de contrat) — c'est le travail de l'équipe, guidé par le cahier des
charges.

---

## 2. Stack

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Framework | NestJS, TypeScript strict | Imposé par le cahier des charges (§6.1) |
| Base de données | PostgreSQL | Imposé (§6.1) — relationnel, adapté aux relations immeuble/unité/bail/paiement |
| ORM | Prisma | Imposé (§6.1) |
| Accès aux données | Repository (port/adapter) | Voir §0 — `docs/backend/adr/0003-*.md` |
| Auth | `@nestjs/jwt` + refresh opaque haché + rotation | Voir `docs/backend/adr/0004-*.md` |
| Validation | `class-validator` + `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) | Standard NestJS, cohérent avec les deux projets sources |
| Paiement | Provider abstrait + Djomy | Voir `docs/backend/paiements-djomy.md` |
| Notifications | Provider abstrait (SMS/email/in-app) | Même principe que `PaymentProvider` — fournisseurs réels non encore choisis (§0bis) |
| PDF | Génération de contrats/quittances — bibliothèque à choisir (ex. `pdf-lib`, `puppeteer` pour un rendu HTML→PDF) | Non tranché — dépend des modèles de contrat (§0bis) |
| Stockage fichiers | Provider abstrait (`StorageProvider`), disque local en développement | Même pattern qu'Oumra-hadj (ADR 0008) |
| Logger | Structuré (Pino) | Voir §0 |
| Tests | Jest (unitaire + e2e) | Standard NestJS |
| Qualité | ESLint flat + Prettier + Husky + lint-staged, règles personnalisées multi-tenant/financier | Voir `docs/backend/multi-tenant.md` et `docs/backend/coding-rules-backend.md` |

---

## 3. Arborescence

Mapping direct des 12 modules fonctionnels du cahier des charges (§3) vers
des modules NestJS :

```
src/
├── main.ts                       # prefix /api, ValidationPipe, CORS, helmet, Swagger /api/docs
├── app.module.ts
├── modules/
│   ├── organizations/             # module 12 (tenant racine) — repository de référence
│   ├── users/                     # module 12 — utilisateurs, rôles
│   ├── auth/                      # authentification (JWT access+refresh, OTP locataire)
│   ├── buildings/                 # module 1 — immeubles
│   ├── units/                     # module 1 — unités locatives (sous-domaine de buildings, ou module propre si volumineux)
│   ├── tenants/                   # module 2 — fiches locataires (distinct de auth.User "locataire" — voir docs/backend/architecture.md)
│   ├── leases/                    # module 3 — baux
│   ├── payments/                  # module 4 — paiements, échéancier
│   ├── invoices/                  # module 5 — quittances, reçus PDF
│   ├── expenses/                  # module 6 — charges & dépenses
│   ├── maintenance/                # module 7 — demandes d'intervention
│   ├── notifications/             # module 8
│   ├── documents/                 # module 10 — gestion documentaire
│   ├── subscriptions/             # module 11 — plans SaaS, facturation plateforme
│   └── admin/                     # module 12 (volet Super Admin transverse)
├── common/
│   ├── guards/       JwtAuthGuard, RolesGuard, TenantScopeGuard, CheckSuperAdmin
│   ├── decorators/   @CurrentUser(), @Roles(), @Public()
│   ├── filters/      AllExceptionsFilter
│   ├── interceptors/ ResponseInterceptor
│   ├── dto/          PaginationQueryDto
│   ├── logger/       Pino
│   └── http/         SuccessResponse / ErrorResponse, PaginatedResult
├── types/
└── prisma/
    ├── prisma.module.ts   # @Global(), exporte PrismaService — jamais injecté ailleurs qu'un repository
    └── prisma.service.ts
```

**`units` comme module séparé ou sous-domaine de `buildings` ?** À trancher
en Phase 1 selon le volume réel de logique propre à une unité (le cahier
des charges les traite ensemble, module 1). Commencer par un seul module
`buildings` avec les unités comme entité enfant est le choix par défaut le
plus simple — séparer seulement si `buildings.service.ts` franchit le seuil
de 400 lignes (§7 `coding-rules-backend.md`) à cause de la logique unités.

**Pourquoi `tenants` (locataires) est distinct de `users` (comptes).** Le
cahier des charges (§5.2) prévoit qu'un locataire existe d'abord comme
fiche (nom, contact, pièce d'identité) **avant** d'avoir un compte — "le
locataire peut créer/activer son propre compte". `Tenant` porte les données
métier, `User` porte l'authentification ; un `Tenant` a un `userId`
optionnel, jamais l'inverse — voir le schéma Prisma de départ
(`config-templates/backend/prisma/schema.prisma`).

---

## 4. Multi-tenant

Voir `docs/backend/multi-tenant.md` pour le détail complet (règle ESLint,
`AuthenticatedUser`, portée intra-organisation du gestionnaire délégué).

Résumé : chaque table métier porte un `organizationId`, chaque requête
Prisma qui la touche filtre dessus, et ce filtre est vérifié par une règle
ESLint personnalisée (répliquée depuis smartsms-backend), pas seulement par
la revue humaine.

---

## 5. Authentification

Voir `docs/backend/adr/0004-authentification-access-refresh-rotation.md`
pour le détail complet. Résumé :

- **Locataire** : téléphone + OTP SMS (cahier des charges §6.4
  "éventuellement OTP par SMS pour les locataires", et §9.2 "connexion à
  l'espace locataire, invité par SMS/email").
- **Propriétaire/gestionnaire/comptable/super admin** : email + mot de
  passe.
- Dans les deux cas : émission d'un couple access (15 min) / refresh
  (opaque, haché, rotatif, 7 jours par défaut) rattaché à une session
  révocable.

---

## 6. Rôles et permissions

Cinq rôles à plat, tels que définis au cahier des charges §4 :

```
super_admin · owner · manager · accountant · tenant
```

(`owner` = Propriétaire/Gérant d'organisation, `manager` = Gestionnaire
délégué, `accountant` = Comptable, `tenant` = Locataire — noms anglais
choisis pour cohérence avec le code, libellés français côté interface.)

Un RBAC à plat (comme Oumra-hadj, pas la matrice de 38 permissions de
smartsms) est le bon niveau de départ — le cahier des charges ne décrit pas
de permissions fines par action, seulement des périmètres d'accès par rôle.

**Point à surveiller** : le "gestionnaire délégué" a une portée **limitée
aux immeubles qui lui sont assignés** (§4) — ce n'est pas qu'un rôle, c'est
aussi un filtre de données à l'intérieur du rôle `manager`. Voir
`docs/backend/multi-tenant.md` §"Portée intra-organisation" pour ne pas le
confondre avec l'isolation inter-organisation.

---

## 7. Conventions

Voir `docs/backend/coding-rules-backend.md` pour le détail complet
(typage strict, taille de fichier, tests, secrets, workflow Git) —
reprises directement de smartsms-backend, qui les applique déjà à un
projet du même profil.

---

## 8. Définition de « terminé »

- [ ] `npm run lint` et `tsc --noEmit` passent, aucun `any`, aucune
      assertion non-null (`!.`)
- [ ] Toute requête sur une table métier filtre par `organizationId`
      (vérifié par la règle ESLint dédiée)
- [ ] Le service métier n'importe pas `PrismaService` directement — passe
      par un repository
- [ ] Toute écriture financière (paiement, abonnement) est gardée par une
      condition de statut, jamais un `update` nu
- [ ] Tests unitaires sur la logique métier ajoutée, y compris en phase
      bootstrap
- [ ] DTO avec décorateurs Swagger dès sa création
- [ ] Pas de secret, clé Djomy ou token en dur

---

## 9. Ordre de construction suggéré

Reprend directement les phases du cahier des charges (§10), dans le même
ordre — ce n'est pas un plan alternatif, c'est sa traduction en étapes
techniques.

**Phase 0 — Cadrage.** Schéma Prisma définitif (voir
`config-templates/backend/prisma/schema.prisma` comme point de départ),
dépôts GitLab, CI/CD.

**Phase 1 — Socle.** `organizations`, `users`, `auth` (access+refresh,
OTP locataire), `TenantScopeGuard`, pattern repository sur `organizations`
comme module de référence (miroir du rôle que joue `clients` chez
smartsms-backend). **Tests d'isolation multi-tenant dès cette phase** — le
cahier des charges l'identifie lui-même comme risque prioritaire (§12.2).

**Phase 2 — Immeubles & baux.** `buildings`, `units`, `tenants`, `leases`
(création, renouvellement, résiliation), états des lieux.

**Phase 3 — Paiements.** `payments` (échéancier, historique),
`DjomyPaymentProvider` (voir `docs/backend/paiements-djomy.md`),
`invoices` (quittances PDF), suivi des impayés.

**Phase 4 — Charges & maintenance.** `expenses`, `maintenance`.

**Phase 5 — Notifications & tableaux de bord.** `notifications`
(SMS/email/in-app), endpoints de reporting consommés par les tableaux de
bord frontend, exports.

**Phase 6 — Abonnement SaaS.** `subscriptions`, facturation des
organisations via Djomy, suspension/limitation automatique, volet Super
Admin transverse.

**Phase 7 — Tests, recette, lancement.** e2e sur les parcours §9 du cahier
des charges, documentation, déploiement.
