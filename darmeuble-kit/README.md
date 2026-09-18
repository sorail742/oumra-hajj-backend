# Kit de démarrage — DarMeuble

Ce dossier contient **tout ce qu'il faut pour démarrer DarMeuble** (plateforme
SaaS multi-tenant de gestion locative d'immeubles — NestJS + Prisma +
PostgreSQL + Next.js + Djomy) sur des bases saines, sans redécouvrir des
problèmes déjà résolus sur deux projets frères.

## D'où vient ce kit

Élaboré en lisant en détail (lecture seule, rien modifié dans les dépôts
sources) **deux projets** :

- **`smartsms-backend` / `smartsms-frontend`** — SaaS multi-tenant réel
  (campagnes SMS), avec plusieurs développeurs, une isolation `clientId`
  stricte, un pattern repository (port/adapter), une rotation de refresh
  token avec détection de réutilisation, et des règles ESLint personnalisées
  qui codifient deux failles réellement trouvées en production (oubli de
  filtre tenant, double crédit sur webhook concurrent).
- **`Oumra-hadj-project` / le kit `oumra-hadj-web-kit`** — backend NestJS
  déjà construit et son frontend Next.js bootstrapé selon la même méthode
  que ce dossier applique ici : proxy BFF avec cookie `httpOnly`, provider
  de paiement abstrait (`PaymentProvider`), registre unique de statuts,
  quatre états outillés sur chaque écran de données.

**Rien n'a été copié-collé aveuglément.** Chaque décision a été confrontée
au cahier des charges DarMeuble (`docs/cahier-des-charges.md`, copie
intégrale du document fourni) avant d'être reprise, adaptée, ou écartée. Le
tableau ci-dessous documente ces choix — c'est la partie la plus importante
de ce kit, celle qui évite de reproduire une décision hors contexte.

## Tableau des emprunts et adaptations

| Sujet | Source | Repris pour DarMeuble | Pourquoi |
| --- | --- | --- | --- |
| Isolation multi-tenant | smartsms-backend (`clientId` sur chaque table métier, `AuthenticatedUser` résolu une fois par `JwtStrategy`) | **Oui, directement** — `organizationId` remplace `clientId` | DarMeuble est multi-tenant dès la Phase 1 du cahier des charges (§4, §6.2) : chaque organisation (propriétaire/agence) est cloisonnée. Oumra-hadj n'a pas ce besoin (une agence n'accède qu'à ses propres données via une relation directe, pas une isolation transverse à toutes les tables) — son modèle ne s'applique pas ici. |
| Pattern repository (port/adapter) | smartsms-backend (ADR-0003) | **Oui, dès le premier module** | DarMeuble est visé pour plusieurs développeurs (cahier des charges §10, phases). Oumra-hadj injecte `PrismaService` directement dans les services — un choix assumé pour un projet plus petit à un seul contributeur principal ; DarMeuble a le profil (multi-tenant + plusieurs contributeurs + données financières) qui justifie le découplage. |
| Règles ESLint personnalisées (filtre tenant obligatoire, écriture financière gardée par statut) | smartsms-backend (`tools/eslint-rules/`) | **Oui, à répliquer** | Ce sont les deux failles réelles qu'aucun ruleset générique ne détecte, et DarMeuble a exactement les deux surfaces à risque : requêtes multi-tenant (immeubles, baux, paiements) et webhooks Djomy concurrents (paiement de loyer + paiement d'abonnement SaaS, tous deux dans le même système). |
| Rotation access/refresh token, jeton opaque haché, détection de réutilisation | smartsms-backend (ADR-0018) | **Oui** | Plus robuste que le refresh JWT signé d'Oumra-hadj, justifié ici par la nature financière de DarMeuble (loyers, abonnements) — le coût d'une session volée y est plus élevé. |
| Enveloppe de réponse `{success,data,meta}` / `{success:false,error}` | smartsms-backend (`ResponseInterceptor`/`AllExceptionsFilter`) | **Oui** | Contrat déjà éprouvé côté frontend (smartsms-frontend le consomme tel quel) ; Oumra-hadj n'a pas d'enveloppe unifiée — un choix qui aurait dû être pris dès le début plutôt que découvert en cours de route, comme documenté dans `docs/contrat-api.md` d'`oumra-hadj-web-kit`. |
| Soft delete généralisé (catégories A/B/C/D, index unique partiel) | smartsms-backend (ADR-0015) | **Oui, sur les entités racines** (`Organization`, `Building`, `Unit`, `Tenant`, `Lease`) | Le cahier des charges exige la traçabilité complète (§5.2, §5.12 "journal d'activité") — une suppression physique d'un bail ou d'un locataire casserait l'historique de paiement qu'il documente lui-même comme un livrable attendu. |
| Provider de paiement abstrait (interface + jeton DI + implémentation mock en dev) | Oumra-hadj-project (`PaymentProvider`, ADR 0006) | **Oui, adapté à Djomy** | Le cahier des charges (§6.3, §12.2) anticipe déjà le risque d'échec/retard des webhooks Djomy — l'abstraction permet de développer et tester sans compte marchand Djomy actif, exactement le problème qu'elle a résolu pour CinetPay côté Oumra-hadj. |
| Proxy Next.js (Route Handlers) + cookie `httpOnly`, jamais `localStorage` | Oumra-hadj-project / `oumra-hadj-web-kit` (ADR-0002 de ce kit) | **Oui** | Même raisonnement, aucune raison de diverger : le frontend ne doit jamais voir le jeton. |
| Quatre états outillés (`AsyncBoundary`), registre unique de statuts (`StatusBadge`) | Oumra-hadj-project / `oumra-hadj-web-kit` | **Oui** | Principes indépendants du domaine, déjà validés deux fois. |
| Logger structuré Pino | smartsms-backend (ADR-0005) | **Oui, dès le départ** | Oumra-hadj utilise le logger Nest par défaut (`console` en développement) — suffisant pour son échelle actuelle, mais DarMeuble vise plusieurs organisations clientes en production dès la Phase 6 (SaaS facturable) : des logs structurés (JSON) sont nécessaires dès qu'un outil d'observabilité externe entre en jeu. |
| Seuil de taille de fichier (400 lignes, `warn`) | smartsms-backend | **Oui** | Discipline de code partagée entre plusieurs contributeurs, coût nul à activer dès le premier fichier plutôt qu'après coup (leur propre expérience : 7 fichiers déjà au-dessus quand la règle a été introduite). |
| Vocabulaire à deux sens (« segment ») | smartsms | **Sans objet** | Rien d'équivalent identifié dans le domaine locatif — section volontairement absente. |
| 8 rôles + matrice de permissions booléenne | smartsms-backend/frontend | **Non, simplifié** | Le cahier des charges (§4) définit 5 rôles clairs et hiérarchiques (Super Admin, Propriétaire/Gérant, Gestionnaire délégué, Comptable, Locataire) sans mention de permissions fines par action — un RBAC à plat, comme celui d'Oumra-hadj (4 rôles), est le bon niveau de complexité de départ. À réévaluer si un besoin de permissions par immeuble/unité (mentionné §4, "gestionnaire délégué... selon les immeubles qui lui sont assignés") dépasse un simple filtre de portée. |

## Ce que ce kit ne contient pas (délibérément)

- **Aucun écran, aucun composant métier construit.** Ce socle décide la
  stack, l'arborescence, les tokens, les patterns transverses et les
  conventions — pas le code des écrans (liste des immeubles, fiche de bail,
  etc.). C'est le travail de l'équipe qui construira DarMeuble.
- **Aucune valeur de secret**, aucune clé Djomy, aucun `.env` rempli.
- **Aucune décision Djomy définitive au-delà de ce que le cahier des
  charges impose.** Le contrat API réel de Djomy (webhooks, champs,
  authentification) n'a pas été vérifié — voir
  `docs/backend/paiements-djomy.md` §"Hypothèse à vérifier en premier".
- **Aucun agent `.claude/` copié.** Les deux projets sources en définissent
  (`revue-mr`, `audit-qualite`) — utiles une fois qu'il y a du code réel à
  relire, à recréer à ce moment-là, pas avant.

## Comment utiliser ce kit

1. Lire `docs/cahier-des-charges.md` si ce n'est pas déjà fait — c'est la
   source de vérité fonctionnelle, ce kit ne fait que la traduire en
   décisions techniques.
2. Lire `docs/backend/socle-backend.md` et `docs/frontend/socle-frontend.md`
   en entier avant d'écrire la première ligne de code.
3. Copier `config-templates/backend/` dans le futur dépôt backend une fois
   `nest new` exécuté, `config-templates/frontend/` dans le futur dépôt
   frontend une fois `pnpm create next-app` exécuté.
4. Copier `code-templates/` — ce sont des fichiers de départ fonctionnels
   (repository de référence, provider Djomy, intercepteurs, proxy Next),
   pas des exemples à retaper.
5. Créer les deux dépôts GitLab (backend, frontend — voir §6.5 du cahier des
   charges), pousser le socle, puis dérouler `docs/backend/adr/README.md`
   pour faire valider chaque ADR `proposé` avant la phase correspondante du
   plan de réalisation (§10 du cahier des charges).
