# Backlog "Cent Fonctionnalités"

Brainstorm de 100 idées de fonctionnalités pour la plateforme, organisées par
bénéficiaire (pèlerins, agences, gouvernement, transverses) — voir le
document complet publié à l'utilisateur pour le contexte de chaque idée.
**Rien ici n'est décidé ni priorisé** : c'est un vivier, pas une feuille de
route.

## Fichier `backlog-100-fonctionnalites.csv`

100 lignes prêtes à importer comme issues GitLab (colonnes `title,description`).
Chaque description contient :

- le bénéficiaire et le numéro d'idée du brainstorm ;
- l'ADR à faire accepter avant implémentation, si l'idée touche un nouveau
  pattern d'architecture ou un nouveau service externe (voir liste
  ci-dessous) — sinon, aucune décision structurante n'est requise ;
- une checklist adaptée à la sensibilité réelle de l'idée (sécurité,
  traçabilité, fiabilité, maintenabilité) — pas le même paragraphe générique
  copié 100 fois.

## Comment importer

GitLab → le projet → **Plan > Issues > Import issues** (icône d'import en
haut de la liste des issues) → sélectionner ce fichier CSV. Aucune clé API
ni jeton n'est nécessaire pour cette voie (contrairement à une création via
l'API GitLab) — c'est pour ça que ce format a été choisi plutôt qu'une
création automatique depuis cette session, qui n'avait pas d'accès API
configuré.

Après import, les issues n'ont pas de label — à ajouter en masse depuis
l'interface GitLab si besoin (ex. `brainstorm`, `pelerin`/`agence`/
`gouvernement`).

## ADR à trancher avant certaines de ces idées

Six ADR ont été proposés pour les groupes d'idées qui touchent un nouveau
pattern d'architecture ou un nouveau service externe (voir
`docs/adr/README.md`) :

| ADR | Sujet | Idées concernées |
|---|---|---|
| [0015](adr/0015-role-gouvernemental-partage-donnees.md) | Rôle gouvernemental et partage de données | #71–90 (sauf composante technique de #82) |
| [0016](adr/0016-api-publique-partenaires.md) | API publique partenaires | #50 |
| [0017](adr/0017-kyc-renforce-agences.md) | KYC renforcé des agences | #60 |
| [0018](adr/0018-canal-sms-ussd.md) | Canal SMS/USSD | #92 |
| [0019](adr/0019-assurance-voyage-integree.md) | Assurance voyage intégrée | #9 |
| [0020](adr/0020-microfinance-partenaire.md) | Microfinance partenaire | #98 |

Toutes restent au statut `proposé` — aucune n'a été validée par l'utilisateur,
contrairement aux ADR 0006/0012/0014 tranchées cette même nuit. Ne pas
commencer l'implémentation d'une idée qui en référence une avant qu'elle ne
passe à `accepté`.

Les 94 autres idées ne nécessitent aucune décision d'architecture préalable
— elles réutilisent des patterns déjà en place (modules NestJS existants,
`PaymentProvider`, `StorageProvider`, ADR 0007 hors-ligne, etc.).

## État d'avancement

- ✅ **#96** Score de confiance agence (`GET /reviews/agency/:id/trust-score`)
- ✅ **#29** Notification pèlerin + contact d'urgence aux étapes clés du dossier
- ✅ **#61** Badge de certification qualité (champ `badge` du trust-score)
- ✅ **#58** Règles de remboursement configurables (`POST /payments/:id/refund`)

## Priorité suggérée pour la suite

Non figée — critères : pas d'ADR bloquant, valeur confiance/sécurité pour le
pèlerin ou l'agence en priorité (cœur du cahier des charges), effort
technique réutilisant au maximum l'existant. Les idées non listées ici
restent disponibles dans le CSV, à trancher au fur et à mesure plutôt que
préclassées à 92 rangs près.

| # | Idée | Pourquoi maintenant |
|---|---|---|
| 23 | Livret souvenir généré automatiquement | Donnée déjà en base (étapes, Duas complétées), pas de nouveau schéma |
| 56 | Alertes de conformité documentaire | Un seul champ à ajouter (`expiresAt` sur `AgencyLegalDocument`) |
| 2 | Simulateur de budget total | Pas de backend nécessaire au départ (calcul côté mobile sur données déjà exposées) |
| 44 | Multi-utilisateurs par agence | Un seul compte propriétaire fait tout aujourd'hui — limite réelle rencontrée à l'usage |
| 10 | Recommandation de forfait personnalisée | Valeur pèlerin directe, filtre sur données déjà exposées (`GET /packages`) |
| 26 | Dons/sadaqa vérifiés | Réutilise `PaymentProvider` tel quel, nouveau flux plutôt que nouveau système |
