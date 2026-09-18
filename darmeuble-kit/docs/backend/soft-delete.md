# DarMeuble — Soft delete

Repris de `smartsms-backend` (ADR-0015 de ce projet frère), qui a découvert
en auditant son propre code que poser une colonne `deletedAt` sans
convention documentée produit des incohérences (deux modèles qui la
portaient déjà, mais dont le repository appelait quand même `.delete()`).
Ce document fixe la convention **avant** le premier appel de suppression,
pas après.

## Pourquoi DarMeuble en a besoin

Le cahier des charges exige la traçabilité complète : "historique complet
des locations d'un locataire" (§5.2), "quittances... historique
téléchargeable" (§5.5), "journal d'activité (qui a fait quoi, quand)"
(§5.12). Une suppression physique d'un `Lease` ou d'un `Tenant` casserait
l'historique de paiement qui en dépend — l'un des livrables attendus
(§11) le documente lui-même comme un historique, pas un instantané.

## Les quatre catégories (même grille que smartsms-backend)

**A — Entités racines métier, `deletedAt` requis.**

| Modèle | Pourquoi |
| --- | --- |
| `Organization` | Résiliation d'un client SaaS — jamais une perte de son historique de facturation |
| `Building` | Un immeuble retiré doit garder son historique de baux/paiements/charges |
| `Unit` | Idem, au niveau de l'unité |
| `Tenant` | Historique de location (§5.2) explicitement exigé |
| `Lease` | Un bail résilié **n'est pas supprimé** — §5.3 distingue explicitement résiliation (avec motif et date de sortie) de suppression |
| `User` | Compte désactivé (départ d'un gestionnaire) ≠ compte supprimé — les actions qu'il a effectuées restent attribuables |

**B — Enregistrements enfants, pas de `deletedAt` propre dans l'immédiat.**
Accessibles uniquement via leur parent : étapes d'état des lieux, lignes de
répartition de charges. Condition explicite (identique à smartsms-backend) :
si un jour une route les interroge indépendamment de leur parent, le modèle
concerné rejoint la catégorie A.

**C — Techniques, hors périmètre.** Sessions, tokens de refresh, codes
OTP, journal d'audit lui-même (`ActivityLog`) — leur cycle de vie propre
(expiration, révocation) n'est pas une suppression au sens métier.

**D — Jamais supprimées, cycle de vie par statut.** `Payment` (un paiement
ne se supprime pas, il change de statut — `pending`/`succeeded`/`failed`/
`refunded`), `SubscriptionPlan` (déprécié par statut, pas supprimé tant
qu'une organisation y est abonnée).

## Cascade — propagation explicite, jamais automatique

Même règle que smartsms-backend : un soft delete (`UPDATE ... SET
deleted_at = now()`) ne déclenche jamais `onDelete: Cascade` — celui-ci ne
s'active que sur un vrai `DELETE`. Archiver une `Organization` doit
explicitement archiver ses `Building` actifs dans la **même transaction**
Prisma (`$transaction`), qui doivent eux-mêmes archiver leurs `Unit`
actives, etc. — jamais en plusieurs appels séparés, pour ne pas laisser un
état incohérent si l'un des appels échoue.

## Contraintes d'unicité — index partiel systématique

Piège déjà rencontré et documenté par smartsms-backend (`Contact`,
migration `20260824223814_scope_contact_unique_to_client`) : poser
`deletedAt` sans ajuster les contraintes uniques bloque toute recréation
après suppression, sur une ligne devenue invisible. Prisma ne sait pas
déclarer d'index partiel (`WHERE`) — SQL brut obligatoire dans la migration :

```sql
DROP INDEX IF EXISTS "<table>_<colonne>_key";

CREATE UNIQUE INDEX "<table>_<scope>_<colonne>_key"
  ON "<table>" ("<colonne_scope>", "<colonne>")
  WHERE "deleted_at" IS NULL;
```

À appliquer dès le schéma de départ pour `Organization.email` du
propriétaire, `User.email`, `Unit` (`buildingId`, `reference`) — un
appartement "A12" archivé ne doit pas empêcher de recréer un "A12" dans le
même immeuble.

## Lecture — filtrer `deletedAt: null` n'est pas optionnel

Tout chemin de lecture d'un modèle de catégorie A doit filtrer
`deletedAt: null` — dans le repository, jamais supposé au niveau service.
La règle ESLint `darmeuble/require-organization-id-filter`
(`docs/backend/multi-tenant.md`) peut être étendue pour vérifier également
la présence de `deletedAt: null` sur les modèles de catégorie A, sur le
même modèle que la règle `require-status-condition-on-write` de
smartsms-backend vérifie une condition de statut — à évaluer une fois le
premier module de catégorie A implémenté, pas avant.
