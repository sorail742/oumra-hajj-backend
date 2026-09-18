# DarMeuble — Design system

Contrat visuel et technique des composants. À lire avant d'écrire un
composant.

Les principes de fabrication (tokens uniques, quatre états outillés,
registre de statuts, choix de surface modale/panneau/page, responsive,
écriture) sont **identiques** à ceux d'`oumra-hadj-web-kit` — ce document
ne les répète pas, il documente ce qui est propre à DarMeuble : la palette,
le registre de statuts réel, et le catalogue de composants métier.

---

## 1. Direction

DarMeuble est un **registre administratif de confiance**, pas une vitrine
immobilière. Un propriétaire y vérifie que ses loyers rentrent, un
locataire y paie son dû et suit sa demande de réparation. Trois
conséquences :

**La clarté financière prime sur tout.** Un montant, un statut de
paiement, une date d'échéance doivent se lire sans ambiguïté au premier
coup d'œil — c'est l'objet même du produit (cahier des charges §2.3,
"traçabilité complète des paiements").

**Le statut d'occupation est un signal, pas une couleur décorative.**
Libre/occupée/en travaux/réservée pour une unité, à jour/en retard pour un
paiement — la couleur porte une information opérationnelle, jamais un
choix esthétique.

**Le chiffre et la référence sont la matière première de la confiance.**
Montants en GNF, références de transaction Djomy, numéros de bail —
tout ce qu'un utilisateur peut avoir besoin de comparer à un reçu papier
ou de relire à voix haute est en police à chasse fixe.

### Identité — se distinguer des deux projets frères

Indigo (smartsms) et sage/or (Oumra-hadj) sont déjà pris dans l'écosystème
de l'équipe. DarMeuble adopte **bleu ardoise profond** (stabilité,
sérieux administratif — convention du secteur immobilier/financier) +
**terracotta** en accent (chaleureux, lié au bâti, réservé aux
marqueurs d'attention). Police interface + police à chasse fixe : à choisir
au moment de l'implémentation (voir `next/font/google`), en évitant Inter
(smartsms) et Source Sans 3 (Oumra-hadj) pour la même raison de
distinction visuelle entre projets de l'équipe.

---

## 2. Tokens

Valeurs de départ (OKLCH, thème clair) — même structure que les deux
projets frères (`@theme inline`, thème sombre en tokens écrits mais
validation différée) :

```css
--primary: oklch(0.38 0.06 250);      /* bleu ardoise profond */
--primary-hover: oklch(0.32 0.06 250);
--primary-subtle: oklch(0.95 0.02 250);
--accent: oklch(0.62 0.15 40);        /* terracotta */
--accent-foreground: oklch(0.98 0.01 40);
```

### Registre de statuts — cinq tons sémantiques, même principe qu'Oumra-hadj

DarMeuble a quatre enums porteurs de statut dès le cahier des charges
(§5.1, §5.3, §5.4, §5.7) — moins que smartsms (70), plus qu'Oumra-hadj à
son démarrage (9) : le principe d'un registre central s'applique dès le
premier.

| Ton | Unité (§5.1) | Bail (§5.3) | Paiement (§5.4) | Maintenance (§5.7) |
| --- | --- | --- | --- | --- |
| `state-pending` | libre | — | à venir | nouvelle |
| `state-progress` | en travaux | — | en attente | en cours |
| `state-success` | occupée | actif | payée | résolue |
| `state-danger` | — | résilié | en retard | annulée |
| `state-warning` | réservée | expire bientôt (calculé) | partiellement payée | — |

```ts
// config/status-registry.ts
export const statusRegistry = {
  unit: {
    free: { label: 'Libre', tone: 'pending' },
    occupied: { label: 'Occupée', tone: 'success' },
    under_maintenance: { label: 'En travaux', tone: 'progress' },
    reserved: { label: 'Réservée', tone: 'warning' },
  },
  lease: {
    active: { label: 'Actif', tone: 'success' },
    terminated: { label: 'Résilié', tone: 'danger' },
    expiring_soon: { label: 'Expire bientôt', tone: 'warning' },
  },
  payment: {
    upcoming: { label: 'À venir', tone: 'pending' },
    pending: { label: 'En attente', tone: 'progress' },
    paid: { label: 'Payée', tone: 'success' },
    overdue: { label: 'En retard', tone: 'danger' },
    partially_paid: { label: 'Partiellement payée', tone: 'warning' },
  },
  maintenanceRequest: {
    new: { label: 'Nouvelle', tone: 'pending' },
    in_progress: { label: 'En cours', tone: 'progress' },
    resolved: { label: 'Résolue', tone: 'success' },
    cancelled: { label: 'Annulée', tone: 'danger' },
  },
} as const;
```

---

## 3. Catalogue de composants métier

Lots A (primitives shadcn) et B (transverses : `DataTable`, `PageHeader`,
`EmptyState`, `Can`, `StatusBadge`, `AsyncBoundary`, `Money`,
`RelativeTime`, `FilterBar`, `ConfirmDialog`) — **identiques** à
`oumra-hadj-web-kit` §7, à copier sans changement de principe, seul le
contenu du registre de statuts change (voir §2 ci-dessus).

### Lot C — Métier, propre à DarMeuble

#### `BuildingOccupancyPlan`

Vue "plan de l'immeuble" (cahier des charges §5.1) : grille des unités
d'un immeuble, chacune avec son `StatusBadge` (`kind="unit"`). C'est
l'écran de vérité recommandé pour valider la vague 1 de primitives
(`table`, `badge`, `skeleton`) — équivalent du rôle que joue "liste des
forfaits" pour Oumra-hadj-web.

#### `LeaseTimeline`

Chronologie d'un bail : signature, échéances passées/à venir, événements
(révision de loyer, état des lieux) — pas un tableau, une frise verticale,
parce qu'un bail se lit dans l'ordre du temps plus naturellement qu'en
lignes.

#### `RentScheduleTracker`

L'échéancier d'un bail (§5.4) — équivalent du `BookingStepTracker`
d'Oumra-hadj-web mais pour des paiements récurrents, pas des étapes
uniques. Affiche chaque échéance avec son `StatusBadge` (`kind="payment"`),
le montant en `Money`, et l'action appropriée selon le statut (« Payer via
Djomy », « Enregistrer un paiement manuel », « Relancer »).

#### `DjomyPaymentFlow`

Redirection/paiement in-app Djomy, retour, attente de webhook, échec —
**toujours accompagné d'un état "vérification en cours"** distinct de
"payé" et d'"échoué" : le cahier des charges (§12.2) anticipe un délai de
confirmation, l'interface doit le représenter honnêtement plutôt que de
faire tourner un spinner indéfiniment ou d'annoncer un succès prématuré.

#### `ManagerScopeIndicator`

Bandeau discret pour un utilisateur `manager` : rappelle quels immeubles
lui sont assignés, visible sur les écrans de liste — pas une alerte, une
information de contexte permanente, parce qu'un gestionnaire qui gère
plusieurs organisations dans sa carrière peut légitimement se demander
"pourquoi je ne vois pas cet immeuble ici".

#### `MaintenanceRequestCard`

Demande d'intervention avec photo, description, `StatusBadge`
(`kind="maintenanceRequest"`) et assignation à un prestataire — modèle
d'écran "détail" (voir §8 d'`oumra-hadj-web-kit`, transposable tel quel).

#### `ExpenseAllocationTable`

Répartition des charges communes entre unités (§5.6) — au prorata de la
surface ou à parts égales selon le paramétrage de l'organisation.
**Toujours afficher la méthode de répartition utilisée à côté du
résultat** (« au prorata de la surface » / « à parts égales ») — un
tableau de chiffres sans cette mention est incompréhensible pour un
locataire qui compare son charge à celle d'un voisin.

#### `SubscriptionStatusBanner`

Visible dans l'espace organisation dès que l'abonnement SaaS approche
l'expiration ou est en défaut de paiement (§5.11, "suspension automatique
ou limitation... en cas d'abonnement expiré/impayé") — bandeau persistant
de type `Alert`, jamais un simple toast qui disparaît en quatre secondes
alors que la conséquence (fonctionnalités limitées) reste, elle,
permanente jusqu'à régularisation.

---

## 4. Ce qui n'est pas repris tel quel des deux projets frères

- **Pas de matrice de 38 permissions** (smartsms) — RBAC à plat, voir
  `docs/frontend/socle-frontend.md` §2.
- **Pas de vocabulaire à deux sens** ("segment" chez smartsms) — rien
  d'équivalent identifié dans le domaine locatif.
- **Pas de composant `SmsComposer`/`SmsCounter`** — DarMeuble envoie des
  SMS de notification (rappels, alertes), pas des campagnes de masse ; un
  simple gabarit de message suffit, sans compteur de segments GSM-7/Unicode.
